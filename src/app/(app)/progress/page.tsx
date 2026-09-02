// src/app/(app)/progress/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { AchievementGrid } from "@/components/progress/AchievementGrid";
import { WeighInDialog } from "@/components/progress/WeighInDialog";
import { WeightChart } from "@/components/progress/WeightChart";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { track } from "@/lib/analytics";
import {
  computeAchievements,
  computeWeekStreak,
  loadMeasurements,
  saveMeasurement,
  shouldInviteWeighIn,
  type Measurement,
} from "@/lib/measurements";
import { loadWorkouts, todayISO, type WorkoutEntry } from "@/lib/workouts";

/**
 * Progress.
 *
 * The retention surface: a reason to open AdimFit that isn't the
 * coach. Training totals lead, milestones follow, and weight sits at
 * the bottom — the ordering is deliberate, since what you DID is the
 * achievement and what you weigh is just information.
 */
export default function ProgressPage() {
  const { user } = useAuth();
  const { profile } = useProfile();

  const [workouts, setWorkouts] = useState<WorkoutEntry[] | null>(null);
  const [measurements, setMeasurements] = useState<Measurement[] | null>(null);
  const [weighInOpen, setWeighInOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.all([loadWorkouts(user.uid), loadMeasurements(user.uid)])
      .then(([loadedWorkouts, loadedMeasurements]) => {
        if (cancelled) return;
        setWorkouts(loadedWorkouts);
        setMeasurements(loadedMeasurements);
      })
      .catch((error) => {
        console.error("[progress] Failed to load:", error);
        if (!cancelled) {
          setWorkouts([]);
          setMeasurements([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const isLoading = workouts === null || measurements === null;
  const today = todayISO();

  const achievements = useMemo(
    () => computeAchievements(workouts ?? [], today),
    [workouts, today],
  );

  const streak = useMemo(
    () => computeWeekStreak(workouts ?? [], today),
    [workouts, today],
  );

  // Milestone streaks only. Firing on every value would flood the
  // funnel with noise and make "reached 4 weeks" impossible to isolate.
  const reportedStreak = useRef<number | null>(null);
  useEffect(() => {
    if (isLoading || streak === 0) return;
    if (![2, 4, 8, 12, 26, 52].includes(streak)) return;
    if (reportedStreak.current === streak) return;
    reportedStreak.current = streak;
    track("streak_week_reached", { streak_length: streak });
  }, [streak, isLoading]);

  useEffect(() => {
    if (!isLoading) track("progress_viewed");
  }, [isLoading]);

  const totals = useMemo(() => {
    const list = workouts ?? [];
    return {
      sessions: list.length,
      minutes: list.reduce((sum, workout) => sum + workout.durationMin, 0),
    };
  }, [workouts]);

  // The fortnightly invitation — shown inline, never as a modal that
  // interrupts. An interruption asking someone to weigh themselves is
  // the kind of nudge that turns into a compulsion.
  const inviteWeighIn = useMemo(
    () => shouldInviteWeighIn(measurements ?? [], today),
    [measurements, today],
  );

  const handleSaveWeight = useCallback(
    async (weightKg: number) => {
      if (!user) return;
      await saveMeasurement(user.uid, weightKg, today);
      setMeasurements(await loadMeasurements(user.uid));
    },
    [user, today],
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          Your record
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
          Progress
        </h1>
        <p className="mt-1.5 text-sm text-white/60">
          Everything you&apos;ve built so far.
        </p>
      </header>

      {isLoading ? (
        <ProgressSkeleton />
      ) : (
        <>
          {/* ── Training totals ─────────────────────────────────── */}
          <section className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-5 sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
              All time
            </p>
            <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06]">
              <Stat label="Sessions" value={String(totals.sessions)} />
              <Stat label="Minutes" value={String(totals.minutes)} />
              <Stat
                label="Week streak"
                value={String(streak)}
                accent={streak > 0}
              />
            </div>
            {streak >= 2 && (
              <p className="mt-4 text-center text-[13px] leading-relaxed text-white/60">
                {streak} consecutive weeks with at least two sessions. Rest
                days included — they&apos;re part of it.
              </p>
            )}
          </section>

          {/* ── Milestones ──────────────────────────────────────── */}
          <section className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-5 sm:p-6">
            <AchievementGrid achievements={achievements} />
          </section>

          {/* ── Weight ──────────────────────────────────────────── */}
          <section className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                Weight
              </p>
              <button
                type="button"
                onClick={() => {
                  track("weigh_in_opened");
                  setWeighInOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[12px] font-medium text-white/60 outline-none transition-colors hover:border-[#CCFF00]/30 hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
              >
                <Plus className="size-3" strokeWidth={2.5} />
                Record
              </button>
            </div>

            {inviteWeighIn && (
              <p className="mt-4 rounded-2xl border border-white/[0.07] bg-black/30 px-4 py-3 text-[13px] leading-relaxed text-white/60">
                It&apos;s been a couple of weeks since your last entry. Worth
                recording if you feel like it.
              </p>
            )}

            <div className="mt-5">
              <WeightChart measurements={measurements} />
            </div>
          </section>
        </>
      )}

      <WeighInDialog
        open={weighInOpen}
        currentWeight={
          measurements && measurements.length > 0
            ? measurements[measurements.length - 1].weightKg
            : profile?.weightKg
        }
        onOpenChange={setWeighInOpen}
        onSave={handleSaveWeight}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-[#0D0F12] px-3.5 py-4 sm:px-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-2xl tabular-nums tracking-tight ${
          accent ? "text-[#CCFF00]" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ProgressSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-6">
        <Skeleton className="h-3 w-20 rounded bg-white/[0.06]" />
        <div className="mt-5 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[84px] rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-6">
        <Skeleton className="h-3 w-24 rounded bg-white/[0.06]" />
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl bg-white/[0.06]" />
          ))}
        </div>
      </div>
    </div>
  );
}