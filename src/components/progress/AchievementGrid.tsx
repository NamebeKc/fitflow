// src/components/progress/AchievementGrid.tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Achievement } from "@/lib/measurements";

interface AchievementGridProps {
  achievements: Achievement[];
}

/**
 * Earned milestones and the ones in reach.
 *
 * Unearned achievements show a progress bar rather than being hidden.
 * A locked mystery is a weaker motivator than a visible "7 of 10" —
 * people finish things they can see the end of.
 *
 * Every milestone here is behavioural: sessions, consistency, variety,
 * accumulated time. Nothing rewards a number on a scale, because
 * rewarding weight change rewards restriction, and rewards it more the
 * more extreme it gets.
 */
export function AchievementGrid({ achievements }: AchievementGridProps) {
  const prefersReducedMotion = useReducedMotion();

  const earned = achievements.filter((achievement) => achievement.earned);
  const pending = achievements.filter((achievement) => !achievement.earned);

  // Nearest-first: the one you're closest to is the one worth chasing.
  const sortedPending = [...pending].sort(
    (a, b) => b.progress / b.target - a.progress / a.target,
  );

  const ordered = [...earned, ...sortedPending];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          Milestones
        </p>
        <p className="font-mono text-[11px] tabular-nums text-white/50">
          {earned.length} / {achievements.length}
        </p>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {ordered.map((achievement, index) => (
          <motion.div
            key={achievement.id}
            initial={
              prefersReducedMotion ? false : { opacity: 0, y: 8 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.3,
              delay: prefersReducedMotion ? 0 : index * 0.04,
              ease: "easeOut",
            }}
            className={cn(
              "rounded-2xl border p-4 transition-colors",
              achievement.earned
                ? "border-[#CCFF00]/25 bg-[#CCFF00]/[0.05]"
                : "border-white/[0.07] bg-black/30",
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                  achievement.earned
                    ? "border-[#CCFF00]/30 bg-[#CCFF00]/10 text-[#CCFF00]"
                    : "border-white/10 bg-white/[0.03] text-white/50",
                )}
              >
                {achievement.earned ? (
                  <Check className="size-4" strokeWidth={3} />
                ) : (
                  <Lock className="size-3.5" strokeWidth={2} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold tracking-[-0.01em]",
                    achievement.earned ? "text-white" : "text-white/70",
                  )}
                >
                  {achievement.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-white/50">
                  {achievement.description}
                </p>

                {!achievement.earned && (
                  <div className="mt-3 space-y-1.5">
                    <div className="h-1 overflow-hidden rounded-full bg-white/[0.08]">
                      <motion.div
                        className="h-full rounded-full bg-[#CCFF00]/60"
                        initial={
                          prefersReducedMotion ? undefined : { width: 0 }
                        }
                        animate={{
                          width: `${Math.round(
                            (achievement.progress / achievement.target) * 100,
                          )}%`,
                        }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                    <p className="font-mono text-[10px] tabular-nums text-white/50">
                      {achievement.progress} / {achievement.target}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}