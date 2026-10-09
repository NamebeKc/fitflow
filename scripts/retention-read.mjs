// scripts/retention-read.mjs
/**
 * ── THE RETENTION READ ──────────────────────────────────────────────
 * STRICTLY READ-ONLY. It opens no write path and calls no setter. Run
 * it as often as you like.
 *
 * It answers the one question the pilot cohort analysis left open:
 * group-posted share cards stopped on 28 August, but sharing is not
 * logging. If people kept logging in-app and simply stopped posting to
 * WhatsApp, the "retention decays to zero" read is wrong in an
 * important and encouraging direction.
 *
 * Workouts live at `users/{uid}/workouts/{workoutId}`, so this walks
 * every user, counts their workouts, and reports first and last
 * activity. It also buckets logs by ISO week so the curve can be
 * compared directly against the WhatsApp table.
 *
 *   node scripts/retention-read.mjs
 *   node scripts/retention-read.mjs --csv > retention.csv
 * ─────────────────────────────────────────────────────────────────────
 */

import { readFileSync } from "node:fs";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

const DAY = 86_400_000;
const today = new Date();

function daysSince(iso) {
  if (!iso) return null;
  const then = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((today.getTime() - then.getTime()) / DAY);
}

/** Monday-anchored week key, so buckets line up with the WhatsApp read. */
function weekKey(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "unknown";
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const csv = process.argv.includes("--csv");

  // Auth is the authoritative user list: someone can exist without ever
  // having written a Firestore document, and those people are exactly
  // the ones worth counting.
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  const rows = [];
  const weeks = new Map();
  let totalLogs = 0;

  for (const user of users) {
    const snap = await db.collection(`users/${user.uid}/workouts`).get();
    const dates = snap.docs
      .map((d) => d.get("date"))
      .filter((d) => typeof d === "string" && d.length >= 10)
      .sort();

    for (const date of dates) {
      const key = weekKey(date);
      if (!weeks.has(key)) weeks.set(key, { logs: 0, users: new Set() });
      const bucket = weeks.get(key);
      bucket.logs += 1;
      bucket.users.add(user.uid);
    }
    totalLogs += dates.length;

    rows.push({
      email: user.email ?? "(no email)",
      name: user.displayName ?? "",
      created: user.metadata.creationTime
        ? new Date(user.metadata.creationTime).toISOString().slice(0, 10)
        : "",
      lastSignIn: user.metadata.lastSignInTime
        ? new Date(user.metadata.lastSignInTime).toISOString().slice(0, 10)
        : "",
      logs: dates.length,
      first: dates[0] ?? "",
      last: dates[dates.length - 1] ?? "",
      silent: dates.length ? daysSince(dates[dates.length - 1]) : null,
    });
  }

  rows.sort((a, b) => b.logs - a.logs || (a.last < b.last ? 1 : -1));

  if (csv) {
    console.log("email,name,created,last_sign_in,logs,first_log,last_log,days_silent");
    for (const r of rows) {
      console.log(
        [r.email, r.name, r.created, r.lastSignIn, r.logs, r.first, r.last, r.silent ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    }
    return;
  }

  console.log(`\nAccounts: ${users.length}   Workouts logged, all time: ${totalLogs}\n`);

  const pad = (s, n) => String(s).padEnd(n);
  console.log(
    pad("EMAIL", 34) + pad("CREATED", 12) + pad("LOGS", 6) +
    pad("FIRST", 12) + pad("LAST", 12) + "SILENT",
  );
  console.log("-".repeat(82));
  for (const r of rows) {
    console.log(
      pad(r.email.slice(0, 33), 34) + pad(r.created, 12) +
      pad(r.logs, 6) + pad(r.first || "—", 12) +
      pad(r.last || "—", 12) + (r.silent === null ? "never logged" : `${r.silent}d`),
    );
  }

  console.log("\nLOGS BY WEEK (week beginning Monday)\n");
  const keys = [...weeks.keys()].sort();
  console.log(pad("WEEK", 14) + pad("LOGS", 8) + "DISTINCT USERS");
  console.log("-".repeat(40));
  for (const key of keys) {
    const b = weeks.get(key);
    console.log(pad(key, 14) + pad(b.logs, 8) + b.users.size);
  }

  const active = rows.filter((r) => r.silent !== null && r.silent <= 7).length;
  const everLogged = rows.filter((r) => r.logs > 0).length;
  console.log(
    `\nEver logged: ${everLogged}/${users.length}` +
    `   Logged in the last 7 days: ${active}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
