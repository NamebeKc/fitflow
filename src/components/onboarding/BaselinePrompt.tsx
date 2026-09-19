// src/components/onboarding/BaselinePrompt.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useProfile } from "@/components/providers/ProfileProvider";
import {
  BASELINE_ACTIVITY,
  type BaselineActivityId,
} from "@/lib/profile";

/**
 * ── THE ONE QUESTION THAT CANNOT BE ASKED LATER ─────────────────────
 * How active someone was before they joined.
 *
 * WHY IT IS NOT IN ONBOARDING. It would sit among questions the coach
 * needs in order to work, and it isn't one — nothing in a prescribed
 * session depends on it. Adding a step that serves reporting rather
 * than the person answering it costs completion at the exact moment
 * completion matters most.
 *
 * WHY IT IS NOT AFTER THE FIRST WORKOUT. ReminderPrompt already owns
 * that moment, and it earns it: reminders drive the return visit.
 * Two cards competing for one moment means both get dismissed. This
 * waits for the SECOND logged workout, by which point the person has
 * a habit worth asking about and the reminder question is settled.
 *
 * THE RECALL PROBLEM, STATED HONESTLY. An answer given two workouts
 * in is already retrospective, and self-reported activity is the
 * weakest evidence there is — the BJ's Wholesale trial found
 * self-reported exercise rose while every clinical marker stayed
 * flat. That is exactly why `baselineCapturedAt` is stored alongside
 * the answer: anyone analysing this later can see how stale the
 * recall was, rather than assuming it was taken at day zero.
 *
 * WRITE-ONCE. The question is about a fixed point in the past. A
 * second answer could only be less accurate than the first, so the
 * card never returns once answered.
 * ─────────────────────────────────────────────────────────────────────
 */

const DISMISS_KEY = "adimfit:baseline-prompt-dismissed";

export function BaselinePrompt({ workoutCount }: { workoutCount: number }) {
  const { profile, updateProfile } = useProfile();
  const prefersReducedMotion = useReducedMotion();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const announced = useRef(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "true");
    } catch {
      setDismissed(false);
    }
  }, []);

  // Two workouts is the gate: past ReminderPrompt, and enough of a
  // pattern that "how were you before this?" reads as interest rather
  // than paperwork.
  const eligible =
    dismissed === false &&
    !done &&
    Boolean(profile) &&
    !profile?.baselineActiveDays &&
    workoutCount >= 2;

  useEffect(() => {
    if (!eligible || announced.current) return;
    announced.current = true;
    track("baseline_activity_prompted", { workout_count: workoutCount });
  }, [eligible, workoutCount]);

  if (!eligible) return null;

  async function answer(id: BaselineActivityId) {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await updateProfile({
        ...profile,
        baselineActiveDays: id,
        baselineCapturedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      track("baseline_activity_answered", {
        baseline: id,
        workout_count: workoutCount,
      });
      setDone(true);
    } catch (error) {
      // A failed write must not strand the card in a spinner. Let them
      // try again, or dismiss.
      console.error("[baseline] Save failed:", error);
      setSaving(false);
    }
  }

  function dismiss() {
    setDismissed(true);
    track("baseline_activity_dismissed", { workout_count: workoutCount });
    try {
      window.localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // Non-fatal.
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-2xl border border-white/[0.09] bg-[#14161A] p-5"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full text-white/35 outline-none transition-colors hover:bg-white/[0.06] hover:text-white/70 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
        >
          <X className="size-3.5" strokeWidth={2.5} />
        </button>

        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          One question
        </p>
        <h3 className="mt-3 pr-8 text-[17px] font-semibold tracking-[-0.02em] text-white">
          Before AdimFit, how many days a week were you active?
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-white/55">
          Roughly is fine. It&apos;s how we tell whether this is actually
          changing anything — and it&apos;s the one thing we can&apos;t work
          out from your log.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BASELINE_ACTIVITY.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={saving}
              onClick={() => void answer(option.id)}
              className={cn(
                "rounded-xl border border-white/[0.09] bg-black/30 px-3 py-3 text-[13px] text-white/75 outline-none transition-all",
                "hover:border-[#CCFF00]/40 hover:bg-[#CCFF00]/[0.06] hover:text-white",
                "focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 active:scale-[0.98]",
                "disabled:opacity-40",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
