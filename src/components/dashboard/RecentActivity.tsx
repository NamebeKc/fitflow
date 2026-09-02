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
    <section className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          Recent activity
        </p>
        {workouts.length > 0 && (
          <Link
            href="/log"
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#CCFF00]/70 outline-none transition-colors hover:text-[#CCFF00] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
          >
            View all
          </Link>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-black/30">
            <ClipboardList className="size-5 text-white/50" strokeWidth={2} />
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-white/50">
            Nothing logged yet. Your sessions appear here — and your coach
            starts learning from them.
          </p>
          <Link
            href="/log"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#CCFF00]/25 bg-[#CCFF00]/[0.07] px-4 py-2 text-sm font-medium text-[#CCFF00] outline-none transition-all hover:bg-[#CCFF00]/[0.12] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 active:scale-[0.99]"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            Log a workout
          </Link>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-white/[0.06]">
          {recent.map((workout) => {
            const Icon = ACTIVITY_ICONS[workout.activity];
            return (
              <li
                key={workout.id}
                className="flex items-center gap-3.5 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-black/30">
                  <Icon className="size-[18px] text-white/50" strokeWidth={2} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {workout.title}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-white/50">
                    {activityLabel(workout.activity)} ·{" "}
                    {formatDate(workout.date)}
                  </p>
                </div>

                <p className="shrink-0 font-mono text-xs tabular-nums text-white/60">
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