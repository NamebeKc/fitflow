// scripts/payout-run.mjs
/**
 * ── MONTHLY PARTNER PAYOUTS ─────────────────────────────────────────
 * Groups accrued bounties by partner, writes a payout record, marks
 * the events paid, and prints a CSV you can reconcile against the
 * transfers you actually send.
 *
 * DELIBERATELY A LOCAL SCRIPT, for the same reason as
 * grant-access.mjs: an endpoint that marks money owed is a permanent
 * attack surface, and nothing here needs to run unattended for ten
 * partners. Same service-account credentials the server uses.
 *
 * MARKING PAID IS NOT SENDING MONEY. This flips events to `paid` and
 * creates a `payouts/{id}` with status `pending`. You then make the
 * transfers by hand and record the reference:
 *
 *   node scripts/payout-run.mjs --dry-run      ← look first, always
 *   node scripts/payout-run.mjs
 *   node scripts/payout-run.mjs --settle <payoutId> <transferRef>
 *
 * Run the dry run first. It is the only cheap moment to notice that a
 * partner's numbers look wrong.
 * ─────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

/* ── Load credentials from .env.local ─────────────────────────────── */

function loadEnv() {
  let raw;
  try {
    raw = readFileSync(".env.local", "utf8");
  } catch {
    console.error("Could not read .env.local — run this from the project root.");
    process.exit(1);
  }

  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function db() {
  if (getApps().length === 0) {
    const env = loadEnv();
    const projectId = env.FIREBASE_PROJECT_ID;
    const clientEmail = env.FIREBASE_CLIENT_EMAIL;
    const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
      console.error("Missing Firebase Admin credentials in .env.local.");
      process.exit(1);
    }
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return getFirestore();
}

const money = (amount, currency) =>
  `${currency} ${Number(amount).toLocaleString()}`;

/* ── The run ──────────────────────────────────────────────────────── */

async function run({ dryRun, periodEnd }) {
  const store = db();

  // Needs the composite index in firestore.indexes.json:
  // referralEvents — status ASC, convertedAt ASC.
  const snapshot = await store
    .collection("referralEvents")
    .where("status", "==", "accrued")
    .where("convertedAt", "<=", Timestamp.fromDate(periodEnd))
    .get();

  if (snapshot.empty) {
    console.log("Nothing accrued up to", periodEnd.toISOString().slice(0, 10));
    return;
  }

  const byPartner = new Map();
  for (const doc of snapshot.docs) {
    const slug = doc.get("partnerSlug");
    byPartner.set(slug, [...(byPartner.get(slug) ?? []), doc]);
  }

  console.log("\npartner,conversions,total,currency,earliest,latest");

  for (const [slug, events] of byPartner) {
    const total = events.reduce((sum, e) => sum + (e.get("amount") ?? 0), 0);
    const currency = events[0].get("currency");

    // A partner's terms fix one currency, so a split here means data
    // has drifted — pay it by hand rather than summing nonsense.
    const mixed = events.some((e) => e.get("currency") !== currency);
    if (mixed) {
      console.error(`\n!! ${slug}: mixed currencies in one period — skipped.`);
      continue;
    }

    const times = events
      .map((e) => e.get("convertedAt")?.toDate?.())
      .filter(Boolean)
      .sort((a, b) => a - b);
    const earliest = times[0]?.toISOString().slice(0, 10) ?? "";
    const latest = times[times.length - 1]?.toISOString().slice(0, 10) ?? "";

    console.log(
      `${slug},${events.length},${total},${currency},${earliest},${latest}`,
    );

    if (dryRun) continue;

    const periodStart = times[0] ?? periodEnd;
    const payoutRef = store.collection("payouts").doc();

    // Firestore caps a batch at 500 writes. Ten partners will never
    // approach it; the guard is here so a good month doesn't silently
    // truncate a payout.
    if (events.length + 1 > 500) {
      console.error(`!! ${slug}: ${events.length} events exceeds one batch.`);
      continue;
    }

    const batch = store.batch();
    batch.create(payoutRef, {
      partnerSlug: slug,
      periodStart: Timestamp.fromDate(periodStart),
      periodEnd: Timestamp.fromDate(periodEnd),
      eventIds: events.map((e) => e.id),
      totalAmount: total,
      currency,
      status: "pending",
      transferReference: null,
      sentAt: null,
      createdAt: Timestamp.now(),
    });
    for (const event of events) {
      batch.update(event.ref, { status: "paid", payoutId: payoutRef.id });
    }
    await batch.commit();

    console.log(`  → payout ${payoutRef.id} (${money(total, currency)})`);
  }

  if (dryRun) {
    console.log("\nDry run — nothing written.");
  }
}

/* ── Recording a transfer you've actually sent ────────────────────── */

async function settle(payoutId, transferReference) {
  const store = db();
  const ref = store.doc(`payouts/${payoutId}`);
  const snapshot = await ref.get();

  if (!snapshot.exists) {
    console.error("No such payout:", payoutId);
    process.exit(1);
  }
  if (snapshot.get("status") === "sent") {
    console.error("Already settled:", payoutId);
    process.exit(1);
  }

  await ref.update({
    status: "sent",
    transferReference,
    sentAt: Timestamp.now(),
  });

  console.log(
    `${payoutId} → sent (${money(
      snapshot.get("totalAmount"),
      snapshot.get("currency"),
    )}, ref ${transferReference})`,
  );
}

/* ── Entry ────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);

if (args[0] === "--settle") {
  const [, payoutId, transferReference] = args;
  if (!payoutId || !transferReference) {
    console.error("Usage: node scripts/payout-run.mjs --settle <id> <ref>");
    process.exit(1);
  }
  await settle(payoutId, transferReference);
} else {
  await run({
    dryRun: args.includes("--dry-run"),
    periodEnd: new Date(),
  });
}
