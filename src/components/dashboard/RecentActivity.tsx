// src/components/dashboard/RecentActivity.tsx
"use client";

import Link from "next/link";
import {
  Bike,
  ClipboardList,
  Dumbbell,
  Flower2,
  Footprints,
  PersonStanding,
  Plus,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { activityLabel, type ActivityId } from "@/lib/profile";
import type { WorkoutEntry } from "@/lib/workouts";

const ACTIVITY_ICONS: Record<ActivityId, LucideIcon> = {
  running: Footprints,
  walking: Footprints,
  cycling: Bike,
  weightlifting: Dumbbell,
  bodyweight: PersonStanding,
  swimming: Waves,
  yoga: Flower2,
  hiit: Zap,
};

interface RecentActivityProps {
  workouts: WorkoutEntry[];
  limit?: number;
}

/** The last few logged sessions, with a link into the full log. */
export function RecentActivity({ workouts, limit = 4 }: RecentActivityProps) {
  const recent = workouts.slice(0, limit);

  return (
    <section className="rounded-lg border border-rule bg-paper-raised p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          Recent activity
        </p>
        {workouts.length > 0 && (
          <Link
            href="/log"
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-indigo/70 outline-none transition-colors hover:text-indigo focus-visible:ring-2 focus-visible:ring-indigo/50"
          >
            View all
          </Link>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-md border border-rule bg-ink/30">
            <ClipboardList className="size-5 text-ink-muted" strokeWidth={2} />
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
            Nothing logged yet. Your sessions appear here — and your coach
            starts learning from them.
          </p>
          <Link
            href="/log"
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo/25 bg-indigo/[0.07] px-4 py-2 text-sm font-medium text-indigo outline-none transition-all hover:bg-indigo/[0.12] focus-visible:ring-2 focus-visible:ring-indigo/50 active:translate-y-px"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            Log a workout
          </Link>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-rule">
          {recent.map((workout) => {
            const Icon = ACTIVITY_ICONS[workout.activity];
            return (
              <li
                key={workout.id}
                className="flex items-center gap-3.5 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-rule bg-ink/30">
                  <Icon className="size-[18px] text-ink-muted" strokeWidth={2} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {workout.title}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                    {activityLabel(workout.activity)} ·{" "}
                    {formatDate(workout.date)}
                  </p>
                </div>

                <p className="shrink-0 font-mono text-xs tabular-nums text-ink-muted">
                  {workout.durationMin}m
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** "2026-07-31" → "Fri, Jul 31" (falls back to the raw string). */
function formatDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}