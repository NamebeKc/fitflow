// src/app/page.tsx
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

/**
 * Dashboard — Phase 1 structural shell.
 *
 * No data sources exist yet, so every region renders its loading state.
 * The skeleton geometry is deliberate: each placeholder matches the exact
 * shape of the content that will replace it (Phase 1 profile/log data,
 * Phase 2 Strava telemetry), so the swap to live data causes zero layout
 * shift. Section eyebrows are real text — the chrome is known, only the
 * data is pending.
 */
export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      {/* ── Page header ────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-2.5">
          {/* Greeting: "Good morning, {firstName}" */}
          <Skeleton className="h-8 w-64 rounded-lg" />
          {/* Contextual subline: date + streak summary */}
          <Skeleton className="h-4 w-44 rounded-md" />
        </div>
        {/* Header avatar */}
        <Skeleton className="size-11 shrink-0 rounded-full" />
      </header>

      {/* ── Primary grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* User Summary — spans 2 columns on desktop */}
        <Card className="border-slate-200/80 shadow-sm lg:col-span-2">
          <CardHeader className="pb-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              User Summary
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Three key metrics: weekly volume, active minutes, goal progress */}
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-4"
                >
                  <Skeleton className="h-3.5 w-20 rounded" />
                  <Skeleton className="h-7 w-16 rounded-md" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              ))}
            </div>

            {/* Weekly volume sparkline / trend chart */}
            <div className="space-y-3">
              <Skeleton className="h-3.5 w-32 rounded" />
              <Skeleton className="h-36 w-full rounded-xl" />
            </div>
          </CardContent>
        </Card>

        {/* AI Coach quick actions */}
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              AI Coach
            </p>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-5">
            {/* Coach status line: "Your plan for today is ready" */}
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="w-full space-y-2">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
            </div>

            <Separator className="bg-slate-100" />

            {/* Quick-action chips: "Plan today's session", "Review last workout", "Ask about form" */}
            <div className="space-y-2.5">
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>

            {/* Primary CTA: "Open AI Coach" */}
            <Skeleton className="mt-auto h-11 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Activity ────────────────────────────────────────── */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
            Recent Activity
          </p>
          {/* "View all" link */}
          <Skeleton className="h-3.5 w-14 rounded" />
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-slate-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                {/* Activity-type icon */}
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                {/* Title + metadata (source, duration, date) */}
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/5 rounded" />
                  <Skeleton className="h-3 w-1/4 rounded" />
                </div>
                {/* Right-aligned primary metric (distance / load) */}
                <div className="hidden shrink-0 space-y-2 sm:block">
                  <Skeleton className="ml-auto h-4 w-16 rounded" />
                  <Skeleton className="ml-auto h-3 w-10 rounded" />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
