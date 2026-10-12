// src/app/api/email/send/route.ts
import { NextResponse } from "next/server";

import { getAdminDb } from "@/lib/firebase-admin";
import { MAX_SENDS_PER_RUN, sendOnce, type Email } from "@/lib/email/mailer";
import { canSend, type EmailKind } from "@/lib/email/preferences";
import {
  lapsed,
  trialEnded,
  trialEnding,
  weeklySummary,
} from "@/lib/email/templates";
import { trackServer } from "@/lib/analytics-server";
import { recipientFor } from "@/lib/email/recipient";

/**
 * ── THE DAILY MAIL RUN ──────────────────────────────────────────────
 * Cloud Scheduler, once a day, protected by the same shared secret as
 * push/send. This endpoint can email every user you have; an open one
 * is a spam cannon pointed at your own domain reputation.
 *
 *   gcloud scheduler jobs create http adimfit-email \
 *     --location=europe-west1 --schedule="0 8 * * *" \
 *     --uri="https://adimfit.com/api/email/send" --http-method=POST \
 *     --headers="x-cron-secret=<PUSH_CRON_SECRET>" \
 *     --attempt-deadline=540s
 *
 * COLLECTION-GROUP INDEXES. The billing query below is
 * `collectionGroup("billing").where("status","==",...)`, and Firestore
 * does NOT create collection-group indexes automatically — its
 * automatic single-field indexes are collection-scoped. Without the
 * entry in firestore.indexes.json this throws FAILED_PRECONDITION and
 * the whole run returns 500. This is the third time that exact
 * footgun has cost this codebase a working feature; see runbook §2.2
 * and §6.
 *
 * EVERY SEND GOES THROUGH `sendOnce`. Scheduler retries on any
 * non-2xx, and a retry that re-sends the batch is how a product
 * teaches people to filter it. The claim is written before the send,
 * so a crash mid-run loses an email rather than duplicating one.
 */

/** Days before trial end to warn. */
const WARN_AT_DAYS = 2;
/** Silence before a nudge, and the gap between nudges. */
const LAPSED_AFTER_DAYS = 7;
const LAPSED_EVERY_DAYS = 14;

const ms = (d: number) => d * 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** ISO week key, e.g. 2026-W42. Scopes the weekly claim. */
function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - start.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Sessions and minutes logged in a window. */
async function activity(uid: string, since: Date) {
  const snap = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("workouts")
    .where("date", ">=", iso(since))
    .get();
  let minutes = 0;
  let lastTitle: string | undefined;
  snap.forEach((doc) => {
    const d = doc.data() as { durationMin?: number; title?: string };
    minutes += Number(d.durationMin ?? 0);
    if (d.title) lastTitle = d.title;
  });
  return { sessions: snap.size, minutes, lastTitle };
}

/** The most recent logged date, or null. */
async function lastLoggedAt(uid: string): Promise<string | null> {
  const snap = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("workouts")
    .orderBy("date", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return (snap.docs[0].data() as { date?: string }).date ?? null;
}

export async function POST(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.PUSH_CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const counts: Record<string, number> = {};
  let budget = MAX_SENDS_PER_RUN;

  async function deliver(
    uid: string,
    kind: EmailKind,
    key: string,
    build: () => Email,
  ) {
    if (budget <= 0) return;
    if (!(await canSend(uid, kind))) return;
    const result = await sendOnce(uid, kind, key, build);
    if (!result.claimed) return;
    budget -= 1;
    counts[kind] = (counts[kind] ?? 0) + 1;
    if (result.sent) {
      await trackServer(uid, "email_sent", { kind }).catch(() => {});
    }
  }

  try {
    const db = getAdminDb();

    // ── Trials: ending, and just ended ────────────────────────────
    const trials = await db
      .collectionGroup("billing")
      .where("status", "==", "trialing")
      .get();

    for (const doc of trials.docs) {
      if (budget <= 0) break;
      const uid = doc.ref.parent.parent?.id;
      const endsAt = (doc.data() as { trialEndsAt?: string }).trialEndsAt;
      if (!uid || !endsAt) continue;

      const end = new Date(endsAt);
      if (Number.isNaN(end.getTime())) continue;
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);

      const to = await recipientFor(uid);
      if (!to) continue;

      if (daysLeft === WARN_AT_DAYS || daysLeft === 1) {
        const { sessions } = await activity(uid, new Date(now.getTime() - ms(14)));
        await deliver(uid, "trial_ending", `${iso(end)}__d${daysLeft}`, () =>
          trialEnding(to, { daysLeft, sessions, endsAt }),
        );
      } else if (daysLeft <= 0 && daysLeft > -3) {
        // A short window, not "any time after". A trial that lapsed
        // in August must not be emailed about today because a backfill
        // changed a field.
        const { sessions } = await activity(uid, new Date(now.getTime() - ms(30)));
        await deliver(uid, "trial_ended", iso(end), () =>
          trialEnded(to, { sessions }),
        );
      }
    }

    // ── Monday: the weekly summary, to everyone entitled ──────────
    if (now.getUTCDay() === 1) {
      const active = await db
        .collectionGroup("billing")
        .where("status", "in", ["active", "trialing"])
        .get();

      for (const doc of active.docs) {
        if (budget <= 0) break;
        const uid = doc.ref.parent.parent?.id;
        if (!uid) continue;
        const to = await recipientFor(uid);
        if (!to) continue;
        const week = await activity(uid, new Date(now.getTime() - ms(7)));
        await deliver(uid, "weekly_summary", isoWeek(now), () =>
          weeklySummary(to, week),
        );
      }
    }

    // ── Gone quiet ────────────────────────────────────────────────
    const entitled = await db
      .collectionGroup("billing")
      .where("status", "in", ["active", "trialing"])
      .get();

    for (const doc of entitled.docs) {
      if (budget <= 0) break;
      const uid = doc.ref.parent.parent?.id;
      if (!uid) continue;

      const last = await lastLoggedAt(uid);
      // Someone who has never logged is an onboarding problem, not a
      // lapsed one, and a "you've gone quiet" email to a person who
      // never started reads as a product that isn't paying attention.
      if (!last) continue;

      const quiet = Math.floor(
        (now.getTime() - new Date(`${last}T00:00:00Z`).getTime()) / 86_400_000,
      );
      if (quiet < LAPSED_AFTER_DAYS) continue;

      const to = await recipientFor(uid);
      if (!to) continue;
      // The key buckets by fortnight, so the claim itself enforces the
      // gap between nudges — no separate "last nudged" field to read,
      // and nothing to get out of sync.
      const bucket = Math.floor(quiet / LAPSED_EVERY_DAYS);
      await deliver(uid, "lapsed", `${last}__${bucket}`, () =>
        lapsed(to, { daysQuiet: quiet }),
      );
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.info("[email/send] run complete", JSON.stringify(counts));
    return NextResponse.json({ sent: total, byKind: counts, budgetLeft: budget });
  } catch (error) {
    console.error("[email/send] Run failed:", error);
    return NextResponse.json({ error: "Run failed" }, { status: 500 });
  }
}
