// src/components/dashboard/WeeklySummary.tsx
"use client";

import { Clock, Dumbbell, Flame } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WeeklyStats } from "@/lib/stats";

interface WeeklySummaryProps {
  stats: WeeklyStats;
}

/**
 * This week at a glance.
 *
 * Numbers are set in mono — they're readouts, not prose, and the
 * tabular figures stop the layout twitching as values change. Only the
 * streak carries lime: it's the one metric that rewards a habit rather
 * than describing volume.
 */
export function WeeklySummary({ stats }: WeeklySummaryProps) {
  const maxMinutes = Math.max(
    ...stats.breakdown.map((entry) => entry.minutes),
    1,
  );

  return (
    <section className="rounded-lg border border-rule bg-paper-raised p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          This week
        </p>
        <p className="font-mono text-[10px] tracking-[0.1em] text-ink-muted">
          LAST 7 DAYS
        </p>
      </div>

      {/* Headline numbers */}
      <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-rule bg-paper-sunken">
        <StatTile
          icon={Dumbbell}
          label="Sessions"
          value={String(stats.sessions)}
        />
        <StatTile icon={Clock} label="Minutes" value={String(stats.minutes)} />
        <StatTile
          icon={Flame}
          label="Streak"
          value={String(stats.streakDays)}
          accent
        />
      </div>

      {/* Where the time went */}
      {stats.breakdown.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            Activity mix
          </p>
          <ul className="space-y-3">
            {stats.breakdown.map((entry) => (
              <li key={entry.activity} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-ink">
                    {entry.label}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-muted">
                    {entry.minutes}m · {entry.sessions}×
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-paper-sunken">
                  <div
                    className="h-full rounded-full bg-indigo/70"
                    style={{
                      width: `${Math.round((entry.minutes / maxMinutes) * 100)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-paper px-3.5 py-4 sm:px-4">
      <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
        <Icon
          className={cn("size-3", accent ? "text-indigo/70" : "")}
          strokeWidth={2.5}
        />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cn(
          "mt-2 font-mono text-2xl tabular-nums tracking-tight",
          accent ? "text-indigo" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}