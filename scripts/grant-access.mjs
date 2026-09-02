// scripts/grant-access.mjs
/**
 * ── COMPLIMENTARY ACCESS ────────────────────────────────────────────
 * Grants a user free access for a number of days, for pilot testers
 * and support gestures.
 *
 * Deliberately a LOCAL SCRIPT rather than an admin API route. An
 * endpoint that can grant free subscriptions is a permanent attack
 * surface guarding the most valuable privilege in the system, and it
 * would need its own authentication, its own allowlist, and its own
 * audit trail. None of that is worth building to serve twenty people
 * from your own laptop.
 *
 * It reads the same service-account credentials the server uses, so
 * anyone who can run it already has database access anyway.
 *
 * USAGE (from the project root):
 *   node scripts/grant-access.mjs someone@example.com 90 "pilot cohort"
 *   node scripts/grant-access.mjs someone@example.com 0        ← revoke
 *   node scripts/grant-access.mjs --list                       ← show grants
 * ─────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

const env = loadEnv();

const projectId = env.FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
// Private keys are stored with literal \n sequences in .env files.
const privateKey = (env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    "Missing Firebase admin credentials in .env.local\n" +
      "Need: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
  );
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();
const auth = getAuth();

/* ── Commands ─────────────────────────────────────────────────────── */

async function listGrants() {
  const snapshot = await db
    .collectionGroup("billing")
    .where("compedUntil", "!=", null)
    .get();

  if (snapshot.empty) {
    console.log("No complimentary grants.");
    return;
  }

  const now = new Date();
  console.log(`\n${snapshot.size} grant(s):\n`);

  for (const document of snapshot.docs) {
    const data = document.data();
    const uid = document.ref.parent.parent?.id ?? "unknown";
    const until = data.compedUntil ? new Date(data.compedUntil) : null;
    const live = until && until > now;

    let email = "—";
    try {
      email = (await auth.getUser(uid)).email ?? "—";
    } catch {
      email = "(deleted user)";
    }

    console.log(
      `  ${live ? "ACTIVE " : "EXPIRED"}  ${email.padEnd(34)} ` +
        `until ${until ? until.toISOString().slice(0, 10) : "?"}` +
        `${data.compedReason ? `  — ${data.compedReason}` : ""}`,
    );
  }
  console.log("");
}

async function grant(email, days, reason) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    console.error(`No account found for ${email}`);
    console.error("They need to sign up first — the grant attaches to a UID.");
    process.exit(1);
  }

  const ref = db
    .collection("users")
    .doc(user.uid)
    .collection("billing")
    .doc("subscription");

  if (days === 0) {
    await ref.set(
      {
        compedUntil: null,
        compedReason: null,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    console.log(`Revoked complimentary access for ${email}`);
    return;
  }

  const until = new Date(Date.now() + days * 86_400_000);

  await ref.set(
    {
      compedUntil: until.toISOString(),
      compedReason: reason ?? "granted",
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  console.log(
    `Granted ${days} days to ${email}\n` +
      `  UID:   ${user.uid}\n` +
      `  Until: ${until.toISOString().slice(0, 10)}\n` +
      `  Note:  ${reason ?? "granted"}`,
  );
}

/* ── Entry point ──────────────────────────────────────────────────── */

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help") {
  console.log(
    "\nGrant complimentary AdimFit access.\n\n" +
      "  node scripts/grant-access.mjs <email> <days> [reason]\n" +
      "  node scripts/grant-access.mjs <email> 0          revoke\n" +
      "  node scripts/grant-access.mjs --list             show grants\n\n" +
      "Example:\n" +
      '  node scripts/grant-access.mjs ada@example.com 90 "pilot cohort"\n',
  );
  process.exit(0);
}

if (args[0] === "--list") {
  await listGrants();
  process.exit(0);
}

const [email, daysArg, ...reasonParts] = args;
const days = Number(daysArg);

if (!email.includes("@")) {
  console.error("First argument must be an email address.");
  process.exit(1);
}
if (!Number.isFinite(days) || days < 0 || days > 3650) {
  console.error("Second argument must be a number of days (0 to revoke).");
  process.exit(1);
}

await grant(email, days, reasonParts.join(" ") || undefined);
process.exit(0);
