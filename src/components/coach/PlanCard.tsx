// src/components/coach/PlanCard.tsx
"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, CheckCircle2, Clock, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { activityLabel } from "@/lib/profile";
import { intensityLabel } from "@/lib/workouts";
import { findExerciseVideo } from "@/lib/exercise-videos";
import { ExerciseVideoLink } from "@/components/coach/ExerciseVideoLink";
import type { DayPlan } from "@/lib/plans";

interface PlanCardProps {
  plan: DayPlan;
  /** True once this plan has been logged. */
  completed: boolean;
  onLog: (plan: DayPlan) => Promise<void>;
}

/**
 * A prescribed session, rendered as something you can act on.
 *
 * The point of this card is the single button at the bottom. Before
 * it, logging a coached session meant reading prose, opening the log,
 * and retyping what you had just been told. Now the plan the coach
 * wrote IS the thing you log.
 *
 * Ticking individual exercises is local-only and deliberately
 * unpersisted: it's a scratchpad for keeping your place mid-session,
 * not a second source of truth about what happened.
 */
export function PlanCard({ plan, completed, onLog }: PlanCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [done, setDone] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  function toggle(index: number) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function log() {
    if (busy || completed) return;
    setBusy(true);
    try {
      await onLog(plan);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="overflow-hidden rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.03]"
    >
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-[#CCFF00]/10 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#CCFF00]/70">
            {completed ? "Logged session" : "Today's session"}
          </p>
          <p className="mt-1.5 truncate text-[15px] font-semibold tracking-[-0.02em] text-white">
            {plan.title}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.07] bg-black/40 px-2.5 py-1 font-mono text-[11px] tabular-nums text-white/50">
          <Clock className="size-3" strokeWidth={2} />
          {plan.estimatedMinutes}m
        </div>
      </div>

      {/* Exercises */}
      <ul className="divide-y divide-white/[0.05]">
        {plan.exercises.map((exercise, index) => {
          const checked = done.has(index);
          // A demo for THIS exercise, looked up by name. Not every
          // prescribed movement is in the library, so the control only
          // appears when there is genuinely something to play.
          const video = findExerciseVideo(exercise.name);

          return (
            <li
              key={`${exercise.name}-${index}`}
              className="flex items-center gap-2 pr-3 transition-colors hover:bg-white/[0.03]"
            >
              {/* Tick and video are separate controls: nesting a button
                  inside a button is invalid markup, and "show me how"
                  shouldn't also mark the set complete. */}
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-pressed={checked}
                className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left outline-none focus-visible:bg-white/[0.03]"
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    checked
                      ? "border-[#CCFF00] bg-[#CCFF00] text-black"
                      : "border-white/15 bg-black/30",
                  )}
                >
                  {checked && <Check className="size-3.5" strokeWidth={3} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm font-medium transition-colors",
                      checked ? "text-white/50 line-through" : "text-white/80",
                    )}
                  >
                    {exercise.name}
                  </span>
                  {exercise.note && (
                    <span className="mt-0.5 block text-xs text-white/50">
                      {exercise.note}
                    </span>
                  )}
                </span>

                <span
                  className={cn(
                    "shrink-0 font-mono text-xs tabular-nums transition-colors",
                    checked ? "text-white/50" : "text-[#CCFF00]",
                  )}
                >
                  {exercise.prescription}
                </span>
              </button>

              {video && <ExerciseVideoLink video={video} compact />}
            </li>
          );
        })}
      </ul>

      {/* Action */}
      <div className="border-t border-[#CCFF00]/10 px-4 py-3.5">
        {completed ? (
          <p className="flex items-center justify-center gap-2 py-1 text-sm font-medium text-[#CCFF00]">
            <CheckCircle2 className="size-4" strokeWidth={2.25} />
            Logged to your history
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void log()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-5 py-3 text-sm font-semibold text-black shadow-[0_10px_30px_-10px_rgba(204,255,0,0.5)] outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#14161A] active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
            ) : (
              <>
                <Check className="size-4" strokeWidth={2.5} />
                Log this session
              </>
            )}
          </button>
        )}

        <p className="mt-2.5 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-white/50">
          {activityLabel(plan.activity)} · {intensityLabel(plan.intensity)} ·{" "}
          {plan.date}
        </p>
      </div>
    </motion.div>
  );
}