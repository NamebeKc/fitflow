// src/app/(app)/log/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics";
import { WorkoutForm } from "@/components/log/WorkoutForm";
import { WorkoutList } from "@/components/log/WorkoutList";
import { ShareWorkoutDialog } from "@/components/share/ShareWorkoutDialog";
import { ReminderPrompt } from "@/components/onboarding/ReminderPrompt";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { computeWeekStreak } from "@/lib/measurements";
import {
  addWorkout,
  deleteWorkout,
  loadWorkouts,
  todayISO,
  type WorkoutEntry,
} from "@/lib/workouts";

/**
 * Workout Log route.
 *
 * Entries load from `users/{uid}/workouts` once the signed-in user is
 * known. Add and delete write to Firestore and return the refreshed
 * list, which replaces local state — a one-way flow, just async.
 */
export default function WorkoutLogPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [workouts, setWorkouts] = useState<WorkoutEntry[] | null>(null);
  const [shareTarget, setShareTarget] = useState<WorkoutEntry | null>(null);
  const [promptReminders, setPromptReminders] = useState(false);
  // Set when a first workout lands, spent when the share sheet closes.
  // A ref rather than state: nothing should re-render on it changing.
  const firstLogPending = useRef(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    loadWorkouts(user.uid).then((loaded) => {
      if (!cancelled) setWorkouts(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const isLoading = workouts === null;

  async function handleAdd(entry: WorkoutEntry) {
    if (!user) return;

    const updated = await addWorkout(user.uid, entry);

    // The form can't know whether this is the user's first session —
    // only the refreshed list can. A length of exactly one means we
    // just crossed the activation milestone.
    if (updated.length === 1) {
      track("workout_first_logged", { source: "manual" });
      // Queued, not shown: the share sheet opens next and two things
      // competing for attention wins neither.
      firstLogPending.current = true;
    }

    setWorkouts(updated);

    // The moment right after logging is when pride is highest — that's
    // when a share is worth offering, not buried in a menu later.
    track("share_dialog_opened", { trigger: "post_log" });
    setShareTarget(entry);
  }

  async function handleDelete(id: string) {
    if (!user) return;
    // Optimistic removal: drop it locally now, sync in the background.
    setWorkouts(
      (current) => current?.filter((workout) => workout.id !== id) ?? null,
    );
    setWorkouts(await deleteWorkout(user.uid, id));
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          Training record
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
          Workout Log
        </h1>
        <p className="mt-1.5 text-sm text-white/60">
          Every session here is context your coach plans around.
        </p>
      </header>

      <ReminderPrompt
        open={promptReminders}
        onDismiss={() => setPromptReminders(false)}
      />

      {isLoading ? (
        <LogSkeleton />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <WorkoutForm onAdd={(entry) => void handleAdd(entry)} />
          </div>
          <div className="lg:col-span-3">
            <WorkoutList
              workouts={workouts}
              onDelete={(id) => void handleDelete(id)}
              onShare={(workout) => {
                track("share_dialog_opened", { trigger: "history" });
                setShareTarget(workout);
              }}
            />
          </div>
        </div>
      )}

      <ShareWorkoutDialog
        workout={shareTarget}
        streakWeeks={computeWeekStreak(workouts ?? [], todayISO())}
        name={profile?.firstName}
        open={shareTarget !== null}
        onOpenChange={(next) => {
          if (next) return;
          setShareTarget(null);
          // The ask lands as the celebration clears, not on top of it.
          if (firstLogPending.current) {
            firstLogPending.current = false;
            setPromptReminders(true);
          }
        }}
      />
    </div>
  );
}

/** Mirrors the form + list geometry so load → content causes no shift. */
function LogSkeleton() {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
      <div className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-5 sm:p-6 lg:col-span-2">
        <Skeleton className="h-3 w-28 rounded bg-white/[0.06]" />
        <div className="mt-5 flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full bg-white/[0.06]" />
          ))}
        </div>
        <Skeleton className="mt-5 h-11 w-full rounded-xl bg-white/[0.06]" />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Skeleton className="h-11 rounded-xl bg-white/[0.06]" />
          <Skeleton className="h-11 rounded-xl bg-white/[0.06]" />
        </div>
        <Skeleton className="mt-4 h-20 w-full rounded-xl bg-white/[0.06]" />
        <Skeleton className="mt-5 h-11 w-full rounded-full bg-white/[0.06]" />
      </div>

      <div className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-5 sm:p-6 lg:col-span-3">
        <Skeleton className="h-3 w-20 rounded bg-white/[0.06]" />
        <div className="mt-4 divide-y divide-white/[0.06]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 py-4">
              <Skeleton className="size-10 shrink-0 rounded-xl bg-white/[0.06]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5 rounded bg-white/[0.06]" />
                <Skeleton className="h-3 w-3/5 rounded bg-white/[0.06]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}