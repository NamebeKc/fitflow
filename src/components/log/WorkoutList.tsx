// src/components/log/WorkoutList.tsx
"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bike,
  ClipboardList,
  Dumbbell,
  Flower2,
  Footprints,
  PersonStanding,
  Share2,
  Trash2,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { activityLabel } from "@/lib/profile";
import {
  formatStrengthSet,
  intensityLabel,
  type ActivityId,
  type WorkoutEntry,
} from "@/lib/workouts";

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

const INTENSITY_STYLES: Record<WorkoutEntry["intensity"], string> = {
  easy: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  moderate: "border-moss/25 bg-lime-wash text-moss",
  hard: "border-orange-400/25 bg-orange-400/10 text-orange-300",
};

interface WorkoutListProps {
  workouts: WorkoutEntry[];
  onDelete: (id: string) => void;
  onShare?: (workout: WorkoutEntry) => void;
}

/** History of logged workouts: summary stats, entries, empty state. */
export function WorkoutList({
  workouts,
  onDelete,
  onShare,
}: WorkoutListProps) {
  const prefersReducedMotion = useReducedMotion();

  const totalMinutes = workouts.reduce(
    (sum, workout) => sum + workout.durationMin,
    0,
  );

  return (
    <section className="rounded-lg border border-rule bg-paper-raised p-6 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          History
        </p>
        {workouts.length > 0 && (
          <p className="shrink-0 font-mono text-[11px] tabular-nums text-ink-muted">
            {workouts.length} · {totalMinutes}m
          </p>
        )}
      </div>

      {workouts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-md border border-rule bg-paper-sunken">
            <ClipboardList className="size-6 text-ink-muted" strokeWidth={2} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-ink-muted">
              No workouts logged yet
            </p>
            <p className="mx-auto max-w-xs text-sm leading-relaxed text-ink-muted">
              Your first entry appears here the moment you add it — and your
              coach starts learning from it.
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-rule">
          <AnimatePresence initial={false}>
            {workouts.map((workout) => {
              const Icon = ACTIVITY_ICONS[workout.activity];
              return (
                <motion.li
                  key={workout.id}
                  layout={!prefersReducedMotion}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, x: -24 }
                  }
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="group flex items-start gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4"
                >
                  <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md border border-rule bg-paper-sunken">
                    <Icon className="size-[18px] text-ink-muted" strokeWidth={2} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <p className="text-sm font-medium text-ink">
                        {workout.title}
                      </p>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]",
                          INTENSITY_STYLES[workout.intensity],
                        )}
                      >
                        {intensityLabel(workout.intensity)}
                      </span>
                    </div>

                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                      {activityLabel(workout.activity)} ·{" "}
                      {formatDate(workout.date)} · {workout.durationMin}m
                    </p>

                    {workout.strength && workout.strength.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {workout.strength.map((set, index) => (
                          <li
                            key={`${set.exercise}-${index}`}
                            className="font-mono text-xs tabular-nums text-ink-muted"
                          >
                            {formatStrengthSet(set)}
                          </li>
                        ))}
                      </ul>
                    )}

                    {typeof workout.steps === "number" && (
                      <p className="mt-2 font-mono text-xs tabular-nums text-ink-muted">
                        {workout.steps.toLocaleString()} steps
                      </p>
                    )}

                    {workout.notes && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
                        {workout.notes}
                      </p>
                    )}
                  </div>

                  {/*
                    Touch devices have no hover, so a hover-revealed
                    control is unreachable there. Always visible below
                    sm; fades in on hover at sm+ where a pointer exists.
                  */}
                  {onShare && (
                    <button
                      type="button"
                      onClick={() => onShare(workout)}
                      aria-label={`Share ${workout.title}`}
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted outline-none transition-all hover:bg-lime-wash hover:text-moss focus-visible:ring-2 focus-visible:ring-moss active:scale-95",
                        "opacity-100 sm:size-8 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100",
                      )}
                    >
                      <Share2 className="size-4" strokeWidth={2} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onDelete(workout.id)}
                    aria-label={`Delete ${workout.title}`}
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted outline-none transition-all hover:bg-red-500/10 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-moss active:scale-95",
                      "opacity-100 sm:size-8 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100",
                    )}
                  >
                    <Trash2 className="size-4" strokeWidth={2} />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

/** "2026-07-28" → "Mon, Jul 28" (falls back to the raw string). */
function formatDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}