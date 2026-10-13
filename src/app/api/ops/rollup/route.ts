// src/app/api/ops/rollup/route.ts
import { NextResponse } from "next/server";

import { getAdminDb } from "@/lib/firebase-admin";
import { computeSnapshot } from "@/lib/ops/metrics";

/**
 * ── THE DAILY SNAPSHOT JOB ──────────────────────────────────────────
 * Writes `metricsDaily/{yyyy-mm-dd}`, which is the only reason a trend
 * line can exist at all. Firestore holds the present; a stock series —
 * subscribers, MRR, founding seats — exists tomorrow only because
 * something wrote it down today.
 *
 * RUNS FOR TWO DAYS, EVERY TIME. Today's row is written so the
 * dashboard has something current, and YESTERDAY'S is rewritten
 * because today's row was partial when it was first computed: a
 * snapshot taken at 09:00 has nine hours of a day in it. Rewriting the
 * previous day once it is closed is what makes the series honest.
 *
 * Attach it to the existing scheduler:
 *
 *   gcloud scheduler jobs create http adimfit-metrics \
 *     --location=europe-west1 --schedule='"5 9 * * *"' \
 *     --time-zone=Africa/Lagos \
 *     --uri=https://adimfit.com/api/ops/rollup --http-method=POST \
 *     --headers=x-cron-secret=SECRET --message-body='"{}"' \
 *     --attempt-deadline=300s
 *
 * Five past the hour, after the email job, so a slow email run cannot
 * delay the numbers that describe it.
 *
 * `?days=N` backfills the last N days on demand. Backfilled stocks are
 * NOT historical — they are today's state stamped with an older date,
 * because the data to reconstruct a past stock does not exist. Flows
 * backfill correctly. Use it to fill a gap after an outage, and know
 * which half of the row you can trust.
 */

const MAX_BACKFILL = 30;

function dayString(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  if (request.headers.get("x-cron-secret") !== process.env.PUSH_CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("days"));
  const days =
    Number.isFinite(requested) && requested > 0
      ? Math.min(Math.floor(requested), MAX_BACKFILL)
      : 2;

  const written: string[] = [];

  try {
    const db = getAdminDb();
    for (let offset = 0; offset < days; offset += 1) {
      const date = dayString(offset);
      const snapshot = await computeSnapshot(date);
      await db.collection("metricsDaily").doc(date).set(snapshot);
      written.push(date);
    }
    console.info("[ops/rollup] wrote", written.join(", "));
    return NextResponse.json({ written });
  } catch (error) {
    console.error("[ops/rollup] Failed:", error);
    return NextResponse.json(
      { error: "Rollup failed", written },
      { status: 500 },
    );
  }
}
