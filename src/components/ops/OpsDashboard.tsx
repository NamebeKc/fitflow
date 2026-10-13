// src/components/ops/OpsDashboard.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/ops/StatTile";
import type { SparkPoint } from "@/components/ops/Sparkline";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * ── THE OPS DASHBOARD ───────────────────────────────────────────────
 * One screen, five questions: are we making money, what is it costing,
 * are people arriving, are the partners worth it, is anything broken.
 *
 * STOCKS AND FLOWS ARE NEVER MIXED IN A TILE. A stock compares against
 * the same stock seven days ago; a flow compares the last seven days
 * against the seven before. Both are labelled, because "+18%" with no
 * denominator is a number you cannot act on.
 *
 * MISSING DAYS ARE SHOWN, NOT ZEROED. A gap in the series means the
 * rollup did not run. Drawing it as zero would invent a day with no
 * revenue and no users, and the chart would look like an outage that
 * never happened — so gaps are listed by date and left out of the line.
 *
 * SMALL MULTIPLES, NOT A COMBINED CHART. Every metric gets its own
 * one-series sparkline rather than sharing axes. Two measures on two
 * scales in one frame is the most common way to make a chart lie, and
 * at this density the grid reads faster anyway.
 * ─────────────────────────────────────────────────────────────────────
 */

/* ── Types mirroring /api/ops/summary ─────────────────────────────── */

interface Snapshot {
  date: string;
  stock: {
    accounts: number;
    onboarded: number;
    byStatus: Record<string, number>;
    entitled: number;
    mrrNgn: number;
    mrrUsd: number;
    lifetimeNgn: number;
    lifetimeUsd: number;
    planMix: Record<string, number>;
    foundingClaimed: number;
    foundingRemaining: number;
  };
  flow: {
    signups: number;
    onboarded: number;
    conversions: number;
    workoutsLogged: number;
    activeLoggers: number;
    emailsByKind: Record<string, number>;
    emailsFailed: number;
    aiRequests: number;
    aiCostUsd: number;
    aiCacheHitRate: number | null;
  };
  partners: Array<{
    slug: string;
    name: string;
    status: string;
    views: number;
    signups: number;
    conversions: number;
    amountEarned: number;
    amountDue: number;
    currency: string;
  }>;
}

interface Summary {
  today: Snapshot;
  history: Snapshot[];
  posthog: {
    days: Array<{ day: string; event: string; count: number }>;
    sources: Array<{ code: string; signups: number }>;
  } | null;
  meta: {
    days: number;
    missingSnapshots: string[];
    usdNgn: number;
    generatedAt: string;
  };
}

/* ── Formatting ───────────────────────────────────────────────────── */

const compact = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return Math.round(n).toLocaleString();
};

const ngn = (n: number) => `₦${compact(n)}`;
const usd = (n: number) =>
  Math.abs(n) < 100 ? `$${n.toFixed(2)}` : `$${compact(n)}`;
const pct = (n: number | null) =>
  n === null ? "—" : `${(n * 100).toFixed(n < 0.1 ? 1 : 0)}%`;

const shortDay = (iso: string) => iso.slice(5);

/* ── Series helpers ───────────────────────────────────────────────── */

function series(
  rows: Snapshot[],
  pick: (row: Snapshot) => number,
): SparkPoint[] {
  return rows.map((row) => ({ label: shortDay(row.date), value: pick(row) }));
}

/** Stock delta: now against the same stock a week ago. */
function stockDelta(points: SparkPoint[]): number | null {
  if (points.length < 8) return null;
  const now = points[points.length - 1].value;
  const then = points[points.length - 8].value;
  if (then === 0) return null;
  return ((now - then) / then) * 100;
}

/** Flow delta: the last seven days against the seven before them. */
function flowDelta(points: SparkPoint[]): number | null {
  if (points.length < 14) return null;
  const sum = (from: number, to: number) =>
    points.slice(from, to).reduce((total, p) => total + p.value, 0);
  const recent = sum(points.length - 7, points.length);
  const prior = sum(points.length - 14, points.length - 7);
  if (prior === 0) return null;
  return ((recent - prior) / prior) * 100;
}

/* ── The dashboard ────────────────────────────────────────────────── */

export function OpsDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">(
    "loading",
  );

  const load = useCallback(async () => {
    if (!user) return;
    setState("loading");
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/ops/summary?days=30", {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      if (response.status === 404) {
        setState("denied");
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      setData((await response.json()) as Summary);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => (data ? [...data.history, data.today] : []),
    [data],
  );

  if (state === "loading") return <OpsSkeleton />;

  if (state === "denied") {
    return (
      <Shell>
        <p className="text-[15px] text-ink">
          This account isn&apos;t on the operations allowlist.
        </p>
        <p className="mt-2 text-[14px] text-ink-muted">
          Add its uid to <code className="font-mono text-[13px]">OPS_UIDS</code>{" "}
          in <code className="font-mono text-[13px]">.env.yaml</code> and
          redeploy.
        </p>
      </Shell>
    );
  }

  if (state === "error" || !data) {
    return (
      <Shell>
        <p className="text-[15px] text-ink">Couldn&apos;t load the numbers.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-rule px-5 py-2.5 text-[13px] font-medium text-ink-muted outline-none transition-colors hover:bg-paper-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-moss"
        >
          <RefreshCw className="size-3.5" strokeWidth={2} />
          Try again
        </button>
      </Shell>
    );
  }

  const { today, meta, posthog } = data;
  const costNgn = today.flow.aiCostUsd * meta.usdNgn;
  const mrrTotalNgn = today.stock.mrrNgn + today.stock.mrrUsd * meta.usdNgn;

  // Monthly inference cost, projected from the last seven days rather
  // than from today — a single day is too noisy to divide revenue by.
  const costSeries = series(rows, (r) => r.flow.aiCostUsd);
  const last7Cost = costSeries
    .slice(-7)
    .reduce((total, p) => total + p.value, 0);
  const monthlyCostNgn = (last7Cost / 7) * 30 * meta.usdNgn;
  const margin =
    mrrTotalNgn > 0 ? (mrrTotalNgn - monthlyCostNgn) / mrrTotalNgn : null;

  return (
    <div className="flex flex-col gap-10">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          Operations · {today.date}
        </p>

        {/* The hero figure. Exactly one per view, and it is the number
            the business lives on. */}
        <h1 className="mt-3 text-[48px] font-semibold leading-none tracking-[-0.03em] text-ink sm:text-[56px]">
          {ngn(mrrTotalNgn)}
        </h1>
        <p className="mt-2 text-[14px] text-ink-muted">
          Monthly recurring revenue, naira and dollar plans combined at ₦
          {meta.usdNgn}/$.{" "}
          {margin !== null && (
            <>
              Gross margin after inference{" "}
              <span className={margin > 0.7 ? "text-success" : "text-warning"}>
                {pct(margin)}
              </span>
              .
            </>
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-ink-faint">
          <span>
            Updated {new Date(meta.generatedAt).toLocaleTimeString("en-GB")}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-full border border-rule px-3 py-1 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-moss"
          >
            <RefreshCw className="size-3" strokeWidth={2} />
            Refresh
          </button>
        </div>
      </header>

      {meta.missingSnapshots.length > 0 && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-warning/30 bg-laterite-wash px-4 py-3 text-[13px] leading-relaxed text-ink"
        >
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-warning"
            strokeWidth={2}
          />
          <span>
            <strong className="font-semibold">
              {meta.missingSnapshots.length} day
              {meta.missingSnapshots.length === 1 ? "" : "s"} missing
            </strong>{" "}
            from the series — the rollup didn&apos;t run on{" "}
            {meta.missingSnapshots.slice(0, 5).join(", ")}
            {meta.missingSnapshots.length > 5 ? " and others" : ""}. Those days
            are left out of the lines rather than drawn as zero.
          </span>
        </p>
      )}

      <Section title="Revenue and entitlement">
        <StatTile
          label="MRR, naira plans"
          value={ngn(today.stock.mrrNgn)}
          points={series(rows, (r) => r.stock.mrrNgn)}
          delta={stockDelta(series(rows, (r) => r.stock.mrrNgn))}
          deltaLabel="vs 7 days ago"
          format={ngn}
        />
        <StatTile
          label="MRR, dollar plans"
          value={usd(today.stock.mrrUsd)}
          points={series(rows, (r) => r.stock.mrrUsd)}
          delta={stockDelta(series(rows, (r) => r.stock.mrrUsd))}
          deltaLabel="vs 7 days ago"
          format={usd}
        />
        <StatTile
          label="Entitled users"
          value={today.stock.entitled.toLocaleString()}
          note={`${today.stock.byStatus.active ?? 0} paying · ${today.stock.byStatus.trialing ?? 0} trialing`}
          points={series(rows, (r) => r.stock.entitled)}
          delta={stockDelta(series(rows, (r) => r.stock.entitled))}
          deltaLabel="vs 7 days ago"
        />
        <StatTile
          label="Past due"
          value={(today.stock.byStatus.past_due ?? 0).toLocaleString()}
          note="Flagged, not revoked — each one gets an email"
          goodWhen="down"
          points={series(rows, (r) => r.stock.byStatus?.past_due ?? 0)}
          delta={stockDelta(series(rows, (r) => r.stock.byStatus?.past_due ?? 0))}
          deltaLabel="vs 7 days ago"
        />
        <StatTile
          label="Cancelled"
          value={(today.stock.byStatus.cancelled ?? 0).toLocaleString()}
          goodWhen="down"
          points={series(rows, (r) => r.stock.byStatus?.cancelled ?? 0)}
          delta={stockDelta(series(rows, (r) => r.stock.byStatus?.cancelled ?? 0))}
          deltaLabel="vs 7 days ago"
        />
        <StatTile
          label="Founding seats left"
          value={today.stock.foundingRemaining.toLocaleString()}
          note={`${today.stock.foundingClaimed} of ${today.stock.foundingClaimed + today.stock.foundingRemaining} claimed`}
          goodWhen="down"
          points={series(rows, (r) => r.stock.foundingClaimed)}
          format={(v) => `${v} claimed`}
        />
      </Section>

      <Section title="Cost and margin">
        <StatTile
          label="Inference, today"
          value={usd(today.flow.aiCostUsd)}
          note={`${ngn(costNgn)} · ${today.flow.aiRequests} requests`}
          goodWhen="none"
          points={costSeries}
          delta={flowDelta(costSeries)}
          deltaLabel="vs previous 7 days"
          format={usd}
        />
        <StatTile
          label="Projected monthly inference"
          value={ngn(monthlyCostNgn)}
          note="Last 7 days, annualised to 30"
          goodWhen="none"
        />
        <StatTile
          label="Cost per entitled user"
          value={
            today.stock.entitled > 0
              ? ngn(monthlyCostNgn / today.stock.entitled)
              : "—"
          }
          note="Monthly inference ÷ entitled users"
          goodWhen="down"
        />
        <StatTile
          label="Prompt cache hit rate"
          value={pct(today.flow.aiCacheHitRate)}
          note="Cached input costs a tenth of the headline rate"
          points={series(rows, (r) => (r.flow.aiCacheHitRate ?? 0) * 100)}
          format={(v) => `${v.toFixed(0)}%`}
        />
      </Section>

      <Section title="Acquisition and activation">
        <StatTile
          label="Accounts created"
          value={today.flow.signups.toLocaleString()}
          note={`${today.stock.accounts} total`}
          points={series(rows, (r) => r.flow.signups)}
          delta={flowDelta(series(rows, (r) => r.flow.signups))}
        />
        <StatTile
          label="Onboarding completed"
          value={today.flow.onboarded.toLocaleString()}
          note={`${today.stock.onboarded} of ${today.stock.accounts} accounts (${pct(
            today.stock.accounts > 0
              ? today.stock.onboarded / today.stock.accounts
              : null,
          )})`}
          points={series(rows, (r) => r.flow.onboarded)}
          delta={flowDelta(series(rows, (r) => r.flow.onboarded))}
        />
        <StatTile
          label="First payments"
          value={today.flow.conversions.toLocaleString()}
          points={series(rows, (r) => r.flow.conversions)}
          delta={flowDelta(series(rows, (r) => r.flow.conversions))}
        />
        <StatTile
          label="Workouts logged"
          value={today.flow.workoutsLogged.toLocaleString()}
          note={`by ${today.flow.activeLoggers} people`}
          points={series(rows, (r) => r.flow.workoutsLogged)}
          delta={flowDelta(series(rows, (r) => r.flow.workoutsLogged))}
        />
      </Section>

      <PostHogSection posthog={posthog} days={meta.days} />

      <Section title="Partners" full>
        {today.partners.length === 0 ? (
          <Empty>No partners yet.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-rule bg-paper-raised">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-rule text-ink-muted">
                  <Th>Partner</Th>
                  <Th numeric>Views</Th>
                  <Th numeric>Signups</Th>
                  <Th numeric>Paid</Th>
                  <Th numeric>View→signup</Th>
                  <Th numeric>Signup→paid</Th>
                  <Th numeric>Owed</Th>
                </tr>
              </thead>
              <tbody>
                {today.partners.map((p) => (
                  <tr key={p.slug} className="border-b border-rule last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink">{p.name}</span>
                      <span className="ml-2 font-mono text-[11px] text-ink-faint">
                        /r/{p.slug}
                      </span>
                      {p.status !== "active" && (
                        <span className="ml-2 rounded-full bg-paper-sunken px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                          {p.status}
                        </span>
                      )}
                    </td>
                    <Td>{p.views.toLocaleString()}</Td>
                    <Td>{p.signups.toLocaleString()}</Td>
                    <Td>{p.conversions.toLocaleString()}</Td>
                    <Td>{pct(p.views > 0 ? p.signups / p.views : null)}</Td>
                    <Td>
                      {pct(p.signups > 0 ? p.conversions / p.signups : null)}
                    </Td>
                    <Td>
                      {p.currency === "NGN"
                        ? ngn(p.amountDue)
                        : usd(p.amountDue)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
          Views are deduped link opens, not visitors — every messaging app
          fetches a link once to build its preview card. Attribution needs the
          same browser for click and signup, so these are a floor, not a census.
        </p>
      </Section>

      <Section title="Delivery and system health">
        <StatTile
          label="Emails sent today"
          value={Object.values(today.flow.emailsByKind)
            .reduce((a, b) => a + b, 0)
            .toLocaleString()}
          note={
            Object.entries(today.flow.emailsByKind)
              .map(([kind, n]) => `${kind.replace(/_/g, " ")} ${n}`)
              .join(" · ") || "nothing due"
          }
          goodWhen="none"
          points={series(rows, (r) =>
            Object.values(r.flow.emailsByKind ?? {}).reduce((a, b) => a + b, 0),
          )}
        />
        <StatTile
          label="Email failures"
          value={today.flow.emailsFailed.toLocaleString()}
          note="Claimed but not delivered — check Resend"
          goodWhen="down"
          points={series(rows, (r) => r.flow.emailsFailed)}
        />
        <StatTile
          label="Coach requests"
          value={today.flow.aiRequests.toLocaleString()}
          goodWhen="none"
          points={series(rows, (r) => r.flow.aiRequests)}
          delta={flowDelta(series(rows, (r) => r.flow.aiRequests))}
        />
        <StatTile
          label="Snapshot gaps"
          value={meta.missingSnapshots.length.toLocaleString()}
          note={`in the last ${meta.days} days`}
          goodWhen="down"
        />
      </Section>
    </div>
  );
}

/* ── PostHog ──────────────────────────────────────────────────────── */

function PostHogSection({
  posthog,
  days,
}: {
  posthog: Summary["posthog"];
  days: number;
}) {
  if (!posthog) {
    return (
      <Section title="Behaviour (PostHog)" full>
        <Empty>
          PostHog isn&apos;t configured. Set{" "}
          <code className="font-mono text-[12px]">POSTHOG_API_KEY</code>,{" "}
          <code className="font-mono text-[12px]">POSTHOG_PROJECT_ID</code> and{" "}
          <code className="font-mono text-[12px]">POSTHOG_API_HOST</code> to see
          the funnel. Everything above is Firestore and is unaffected.
        </Empty>
      </Section>
    );
  }

  const totals = new Map<string, number>();
  for (const row of posthog.days) {
    totals.set(row.event, (totals.get(row.event) ?? 0) + row.count);
  }

  const funnel = [
    { event: "landing_page_viewed", label: "Landing viewed" },
    { event: "signup_completed", label: "Signed up" },
    { event: "onboarding_completed", label: "Onboarded" },
    { event: "coach_first_message_sent", label: "Asked the coach" },
    { event: "workout_first_logged", label: "Logged a workout" },
  ].map((step) => ({ ...step, count: totals.get(step.event) ?? 0 }));

  const top = funnel[0].count;

  return (
    <Section title={`Behaviour · last ${days} days (PostHog)`} full>
      <div className="rounded-lg border border-rule bg-paper-raised p-5">
        <ol className="space-y-3">
          {funnel.map((step, i) => {
            const share = top > 0 ? step.count / top : 0;
            const prior = i === 0 ? null : funnel[i - 1].count;
            return (
              <li key={step.event}>
                <div className="flex items-baseline justify-between gap-4 text-[13px]">
                  <span className="text-ink">{step.label}</span>
                  <span className="font-mono tabular-nums text-ink-muted">
                    {step.count.toLocaleString()}
                    {prior !== null && prior > 0 && (
                      <span className="ml-2 text-ink-faint">
                        {pct(step.count / prior)} of previous
                      </span>
                    )}
                  </span>
                </div>
                {/* A meter, not a bar chart: one measure, ordered, and
                    the track is a lighter step of the same hue so the
                    state reads across the whole width. */}
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-lime-wash">
                  <div
                    className="h-full rounded-full bg-moss"
                    style={{ width: `${Math.max(share * 100, step.count > 0 ? 1.5 : 0)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>

        {posthog.sources.length > 0 && (
          <div className="mt-6 border-t border-rule pt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              Signups by source
            </p>
            <ul className="mt-3 space-y-1.5 text-[13px]">
              {posthog.sources.map((source) => (
                <li
                  key={source.code}
                  className="flex items-baseline justify-between gap-4"
                >
                  <span className="text-ink">{source.code}</span>
                  <span className="font-mono tabular-nums text-ink-muted">
                    {source.signups.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}

/* ── Layout pieces ────────────────────────────────────────────────── */

function Section({
  title,
  children,
  full,
}: {
  title: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-4 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h2>
      <div
        className={cn(
          full
            ? ""
            : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        )}
      >
        {children}
      </div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-rule bg-paper-raised p-5 text-[13px] leading-relaxed text-ink-muted">
      {children}
    </p>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl rounded-lg border border-rule bg-paper-raised p-6">
      {children}
    </div>
  );
}

function Th({
  children,
  numeric,
}: {
  children: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 font-mono text-[10px] font-normal uppercase tracking-[0.14em]",
        numeric && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-4 py-3 text-right font-mono tabular-nums text-ink">
      {children}
    </td>
  );
}

function OpsSkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <Skeleton className="h-3 w-40 rounded bg-paper-sunken" />
        <Skeleton className="mt-3 h-12 w-64 rounded-md bg-paper-sunken" />
        <Skeleton className="mt-3 h-3 w-80 rounded bg-paper-sunken" />
      </div>
      {[0, 1].map((section) => (
        <div key={section}>
          <Skeleton className="mb-4 h-4 w-48 rounded bg-paper-sunken" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((tile) => (
              <Skeleton
                key={tile}
                className="h-[164px] rounded-lg bg-paper-sunken"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
