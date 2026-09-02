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
    <section className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          This week
        </p>
        <p className="font-mono text-[10px] tracking-[0.1em] text-white/50">
          LAST 7 DAYS
        </p>
      </div>

      {/* Headline numbers */}
      <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06]">
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
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
            Activity mix
          </p>
          <ul className="space-y-3">
            {stats.breakdown.map((entry) => (
              <li key={entry.activity} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-white/80">
                    {entry.label}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/50">
                    {entry.minutes}m · {entry.sessions}×
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-[#CCFF00]/70"
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
    <div className="bg-[#0D0F12] px-3.5 py-4 sm:px-4">
      <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
        <Icon
          className={cn("size-3", accent ? "text-[#CCFF00]/70" : "")}
          strokeWidth={2.5}
        />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cn(
          "mt-2 font-mono text-2xl tabular-nums tracking-tight",
          accent ? "text-[#CCFF00]" : "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}