// scripts/partner-add.mjs
/**
 * ── PARTNER ONBOARDING ──────────────────────────────────────────────
 * Creates the `partners/{slug}` document that the referral ledger
 * reads. Without it nothing works: `recordReferralConversion` looks
 * the partner up, finds nothing, and returns `inactive` — so a
 * referred customer pays, the subscription activates, and no bounty
 * is ever recorded. Silently. This script is the missing half of
 * payout-run.mjs.
 *
 * LOCAL, like grant-access.mjs and for the same reason: an endpoint
 * that can mint a payment obligation is a permanent attack surface,
 * and nothing here needs to run unattended for ten partners.
 *
 *   node scripts/partner-add.mjs --slug adura --name "Adura Coaching" \
 *       --amount 5000 --currency NGN --cap 250000
 *   node scripts/partner-add.mjs --list
 *   node scripts/partner-add.mjs --slug adura --deactivate
 *   node scripts/partner-add.mjs --slug adura --rotate-token
 * ─────────────────────────────────────────────────────────────────────
 */

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

/* ── Credentials ──────────────────────────────────────────────────── */

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
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[trimmed.slice(0, eq).trim()] = value;
  }
  return env;
}

const env = loadEnv();
const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase admin credentials in .env.local");
  process.exit(1);
}
if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();
const auth = getAuth();

const APP_URL = env.NEXT_PUBLIC_APP_URL ?? "https://adimfit.com";
const money = (amount, currency) =>
  `${currency} ${Number(amount).toLocaleString()}`;

/* ── Arguments ────────────────────────────────────────────────────── */

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

/* ── Commands ─────────────────────────────────────────────────────── */

async function list() {
  const snapshot = await db.collection("partners").get();
  if (snapshot.empty) {
    console.log(
      "\nNo partners yet.\n\n" +
        "Until one exists, every referred conversion records nothing —\n" +
        "the ledger looks the partner up, finds no document, and skips.\n",
    );
    return;
  }

  console.log(`\n${snapshot.size} partner(s):\n`);
  for (const document of snapshot.docs) {
    const data = document.data();
    const counters = data.counters ?? {};
    const terms = data.terms ?? {};
    console.log(
      `  ${data.status === "active" ? "ACTIVE  " : "INACTIVE"} ${document.id.padEnd(16)} ` +
        `${money(terms.amount ?? 0, terms.currency ?? "?").padEnd(14)} ` +
        `views ${String(counters.views ?? 0).padEnd(6)} ` +
        `signups ${String(counters.signups ?? 0).padEnd(5)} ` +
        `conversions ${String(counters.conversions ?? 0).padEnd(5)} ` +
        `accrued ${money(counters.accruedAmount ?? 0, terms.currency ?? "?")}`,
    );
  }
  console.log("");
}

async function upsert(options) {
  const slug = String(options.slug ?? "").trim().toLowerCase();

  // The slug becomes a public URL and the document ID. Restricting it
  // now avoids a partner whose link needs escaping, and a document ID
  // that cannot be typed.
  if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(slug)) {
    console.error(
      "--slug must be 2-31 chars, lowercase letters, digits and hyphens.",
    );
    process.exit(1);
  }

  const ref = db.doc(`partners/${slug}`);
  const existing = await ref.get();

  if (options.deactivate) {
    if (!existing.exists) {
      console.error(`No such partner: ${slug}`);
      process.exit(1);
    }
    await ref.update({ status: "inactive", updatedAt: Timestamp.now() });
    console.log(
      `${slug} deactivated. Bounties already accrued are unaffected and\n` +
        `still appear in the next payout run.`,
    );
    return;
  }

  if (options.reset) {
    if (!existing.exists) {
      console.error(`No such partner: ${slug}`);
      process.exit(1);
    }
    const email = existing.get("email");
    if (!email) {
      console.error(`${slug} has no email — re-run with --email to add one.`);
      process.exit(1);
    }
    const link = await auth.generatePasswordResetLink(email);
    console.log(`Password link for ${email}:\n  ${link}`);
    return;
  }

  if (options["rotate-token"]) {
    if (!existing.exists) {
      console.error(`No such partner: ${slug}`);
      process.exit(1);
    }
    const viewToken = randomBytes(24).toString("hex");
    await ref.update({ viewToken, updatedAt: Timestamp.now() });
    console.log(`New dashboard link:\n  ${APP_URL}/p/${slug}?t=${viewToken}`);
    return;
  }

  const amount = Number(options.amount);
  const currency = String(options.currency ?? "NGN").toUpperCase();
  const windowDays = Number(options.window ?? 60);
  const cap = options.cap === undefined ? null : Number(options.cap);

  if (!Number.isFinite(amount) || amount <= 0) {
    console.error("--amount must be a positive number (major units).");
    process.exit(1);
  }
  if (!["NGN", "USD"].includes(currency)) {
    console.error("--currency must be NGN or USD.");
    process.exit(1);
  }
  if (cap !== null && (!Number.isFinite(cap) || cap < amount)) {
    console.error("--cap must be at least one bounty, or omitted.");
    process.exit(1);
  }

  // Counters are only initialised on CREATE. Resetting them on an
  // edit would erase the record of what has already been earned, and
  // the payout run reads them to decide what is owed.
  const base = {
    name: options.name ? String(options.name) : slug,
    status: "active",
    terms: { amount, currency, attributionWindowDays: windowDays },
    cap: cap === null ? null : { totalAmount: cap, currency },
    updatedAt: Timestamp.now(),
  };

  /**
   * Partner sign-in runs on Firebase Auth rather than a bespoke
   * password table. It already exists, it already handles sessions
   * and rate limiting, and — the deciding factor — its password-reset
   * email is sent by Firebase from auth.adimfit.com, which works
   * today. AdimFit has no transactional email of its own, so any
   * scheme needing us to send mail could not have shipped.
   *
   * INVITE ONLY. There is no public partner signup. Every conversion
   * is a payment obligation, so an open form would let anyone mint a
   * code and refer themselves. Accounts are created here, by someone
   * who has the service-account key.
   *
   * The partner never receives a password from us — they set their
   * own through the reset link, so no credential passes through chat,
   * email drafts or these logs.
   */
  if (options.email) {
    const email = String(options.email).trim().toLowerCase();
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`Linked existing account for ${email}.`);
    } catch {
      user = await auth.createUser({ email, emailVerified: false });
      console.log(`Created account for ${email}.`);
    }
    base.email = email;
    base.authUid = user.uid;

    const link = await auth.generatePasswordResetLink(email);
    console.log(
      `\nSend them this to set a password (expires — regenerate with` +
        ` --reset if it lapses):\n  ${link}\n`,
    );
  }

  if (existing.exists) {
    await ref.set(base, { merge: true });
    console.log(`Updated ${slug}.`);
  } else {
    const viewToken = randomBytes(24).toString("hex");
    await ref.set({
      ...base,
      viewToken,
          counters: {
        views: 0,
        signups: 0,
        conversions: 0,
        accruedAmount: 0,
        paidAmount: 0,
      },
      createdAt: Timestamp.now(),
    });
    console.log(`Created ${slug}.`);
    console.log(`\nDashboard (private — send only to the partner):`);
    console.log(`  ${APP_URL}/p/${slug}?t=${viewToken}`);
  }

  console.log(`\nTheir referral link:`);
  console.log(`  ${APP_URL}/r/${slug}`);
  console.log(`\nTheir dashboard:`);
  console.log(`  ${APP_URL}/partners`);
  console.log(
    `\n  ${money(amount, currency)} per conversion` +
      `${cap === null ? ", uncapped" : `, capped at ${money(cap, currency)}`}` +
      `\n  ${windowDays}-day attribution window, first touch wins\n`,
  );
}

/* ── Entry ────────────────────────────────────────────────────────── */

const options = parseArgs(process.argv.slice(2));

if (process.argv.length === 2 || options.help) {
  console.log(
    "\nOnboard a referral partner.\n\n" +
      "  node scripts/partner-add.mjs --slug <slug> --name <name> \\\n" +
      "      --email <addr> --amount <n> [--currency NGN] [--cap <n>]\n" +
      "  node scripts/partner-add.mjs --slug <slug> --reset\n" +
      "  node scripts/partner-add.mjs --list\n" +
      "  node scripts/partner-add.mjs --slug <slug> --deactivate\n" +
      "  node scripts/partner-add.mjs --slug <slug> --rotate-token\n\n" +
      "Example:\n" +
      '  node scripts/partner-add.mjs --slug adura --name "Adura Coaching" \\\n' +
      "      --email adura@example.com --amount 5000 --cap 250000\n",
  );
  process.exit(0);
}

if (options.list) {
  await list();
} else {
  await upsert(options);
}
