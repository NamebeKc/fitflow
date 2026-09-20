// scripts/seed-founding.mjs
/**
 * Creates or reads the founding-seat counter at `config/founding`.
 *
 * The paywall reads this through /api/founding to print "142 of 200
 * seats left". If the document is missing the endpoint returns zero
 * claimed, which advertises the full 200 — true today, but it should
 * be set deliberately rather than inferred from an absent document.
 *
 * Field names must match `billing-admin.ts` exactly. A typo here
 * reads back as zero forever, silently, which is why this is a script
 * and not a console click.
 *
 *   node scripts/seed-founding.mjs            show current state
 *   node scripts/seed-founding.mjs --init     create if missing
 *   node scripts/seed-founding.mjs --limit 300
 */

import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function loadEnv() {
  let raw;
  try {
    raw = readFileSync(".env.local", "utf8");
  } catch {
    console.error("Could not read .env.local — run from the project root.");
    process.exit(1);
  }
  const env = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[t.slice(0, eq).trim()] = v;
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
const ref = db.doc("config/founding");
const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const limit = limitArg !== -1 ? Number(args[limitArg + 1]) : 200;

if (!Number.isFinite(limit) || limit < 1) {
  console.error("--limit must be a positive number.");
  process.exit(1);
}

const snapshot = await ref.get();

if (!snapshot.exists) {
  if (!args.includes("--init") && limitArg === -1) {
    console.log("\nconfig/founding does not exist yet.");
    console.log("The paywall will show all seats available.\n");
    console.log("  node scripts/seed-founding.mjs --init\n");
    process.exit(0);
  }
  await ref.set({
    claimed: 0,
    limit,
    updatedAt: new Date().toISOString(),
  });
  console.log(`Created config/founding — 0 of ${limit} seats claimed.`);
} else {
  const claimed = snapshot.get("claimed") ?? 0;
  const current = snapshot.get("limit") ?? 200;

  if (limitArg !== -1 && limit !== current) {
    // Never touch `claimed` — it is the count of people who actually
    // bought at founding pricing, and rewriting it would misreport
    // what has been sold.
    await ref.set({ limit, updatedAt: new Date().toISOString() }, { merge: true });
    console.log(`Limit ${current} → ${limit}. Claimed left at ${claimed}.`);
  } else {
    console.log(
      `\nconfig/founding: ${claimed} of ${current} claimed, ` +
        `${Math.max(0, current - claimed)} remaining.\n`,
    );
  }
}
