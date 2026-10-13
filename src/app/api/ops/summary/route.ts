// src/app/api/ops/summary/route.ts
import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { computeSnapshot, type DailySnapshot } from "@/lib/ops/metrics";
import { fetchPostHog, type PostHogData } from "@/lib/ops/posthog";
import { rates, usdToNgn } from "@/lib/ops/cost";

/**
 * ── THE OPS READ ────────────────────────────────────────────────────
 * Everything the dashboard needs, in one request: today computed live,
 * the preceding days read from stored snapshots, and PostHog's
 * behavioural trend alongside.
 *
 * TODAY IS COMPUTED, HISTORY IS READ. Today's row changes every hour
 * and nobody wants a dashboard that is as stale as the last cron run.
 * Every earlier day comes from `metricsDaily`, because recomputing a
 * past stock is impossible — Firestore only knows the present — and
 * recomputing past flows would mean scanning the whole database on
 * every page load.
 *
 * ACCESS IS A UID ALLOWLIST. This returns revenue, per-partner payout
 * balances and inference spend. `OPS_UIDS` is a comma-separated list
 * of Firebase uids; anyone else gets a 404 rather than a 403, because
 * a 403 confirms the route exists and is worth attacking.
 *
 * It returns NO per-customer rows — no uid, no email, no individual
 * subscription. Aggregates answer every operational question here,
 * and an admin screen that lists customers is a data breach with a
 * login page in front of it.
 */

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

function allowedUids(): Set<string> {
  return new Set(
    (process.env.OPS_UIDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

async function requireOpsUid(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const allowed = allowedUids();
  // An empty allowlist locks everyone out rather than letting everyone
  // in. A misconfigured admin route must fail closed.
  if (allowed.size === 0) {
    console.error("[ops/summary] OPS_UIDS is not set; refusing all access");
    return null;
  }

  try {
    const { uid } = await getAdminAuth().verifyIdToken(token);
    return allowed.has(uid) ? uid : null;
  } catch {
    return null;
  }
}

function dayString(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

export interface OpsSummary {
  today: DailySnapshot;
  history: DailySnapshot[];
  posthog: PostHogData | null;
  meta: {
    days: number;
    missingSnapshots: string[];
    usdNgn: number;
    aiRates: ReturnType<typeof rates>;
    generatedAt: string;
  };
}

export async function GET(request: Request) {
  const uid = await requireOpsUid(request);
  if (!uid) {
    // Same response as a route that does not exist.
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("days"));
  const days =
    Number.isFinite(requested) && requested > 0
      ? Math.min(Math.floor(requested), MAX_DAYS)
      : DEFAULT_DAYS;

  try {
    const db = getAdminDb();
    const wanted = Array.from({ length: days }, (_, i) => dayString(i + 1));

    const [today, snapshots, posthog] = await Promise.all([
      computeSnapshot(dayString(0)),
      db
        .collection("metricsDaily")
        .where("date", ">=", wanted[wanted.length - 1])
        .orderBy("date", "asc")
        .get(),
      fetchPostHog(days),
    ]);

    const history = snapshots.docs
      .map((doc) => doc.data() as DailySnapshot)
      .filter((row) => row.date !== today.date);

    const present = new Set(history.map((row) => row.date));
    // Named explicitly rather than drawn as a zero. A gap in the series
    // is a cron that did not run, and a chart that plots it as zero
    // revenue is worse than one that admits it does not know.
    const missingSnapshots = wanted
      .filter((date) => !present.has(date))
      .reverse();

    const payload: OpsSummary = {
      today,
      history,
      posthog,
      meta: {
        days,
        missingSnapshots,
        usdNgn: usdToNgn(),
        aiRates: rates(),
        generatedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[ops/summary] Failed:", error);
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }
}
