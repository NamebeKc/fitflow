// src/app/(app)/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { TabGuide } from "@/components/onboarding/TabGuide";
import { BaselinePrompt } from "@/components/onboarding/BaselinePrompt";
import { CoachQuickActions } from "@/components/dashboard/CoachQuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { WeeklySummary } from "@/components/dashboard/WeeklySummary";
import { WelcomeState } from "@/components/dashboard/WelcomeState";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { computeWeeklyStats } from "@/lib/stats";
import { loadWorkouts, type WorkoutEntry } from "@/lib/workouts";

/**
 * Dashboard.
 *
 * Brand-new users (no profile) are sent straight to onboarding —
 * guidance beats instruction. Users with a profile but no workouts get
 * the WelcomeState. Everyone else gets the real thing.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const [workouts, setWorkouts] = useState<WorkoutEntry[] | null>(null);

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

  const isLoading = profileLoading || workouts === null;
  const needsOnboarding = !isLoading && !profile;

  useEffect(() => {
    if (needsOnboarding) router.replace("/profile");
  }, [needsOnboarding, router]);

  const stats = useMemo(() => computeWeeklyStats(workouts ?? []), [workouts]);

  // The retention anchor. PostHog's retention table uses this as both
  // the initial and returning event, and that grid is the number
  // gating Phase 3, Phase 4, and every distribution channel.
  useEffect(() => {
    if (!isLoading && profile) track("dashboard_viewed");
  }, [isLoading, profile]);

  const hasWorkouts = (workouts?.length ?? 0) > 0;
  const showWelcome = !isLoading && profile && !hasWorkouts;
  const showDashboard = !isLoading && profile && hasWorkouts;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
            {greeting()}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            {profile ? profile.firstName : "Dashboard"}
          </h1>
          <p className="mt-1.5 text-sm text-white/60">
            {subline(isLoading, stats.sessions)}
          </p>
        </div>

        {showDashboard && <WeekStrip workouts={workouts ?? []} />}
      </header>

      {/* Only surfaces in the trial's final days — see TrialBanner. */}
      <TrialBanner />

      {/* Shown until dismissed. Four pilot users asked for features
          that already existed; this is cheaper than building them
          again. */}
      {!isLoading && profile && <TabGuide />}

      {/* Self-gating: waits for the second logged workout so it never
          competes with ReminderPrompt, and never returns once
          answered. See BaselinePrompt for why it isn't in onboarding. */}
      {!isLoading && profile && (
        <BaselinePrompt workoutCount={workouts?.length ?? 0} />
      )}

      {(isLoading || needsOnboarding) && <DashboardSkeleton />}

      {showWelcome && (
        <WelcomeState
          displayName={profile?.firstName ?? user?.displayName}
          hasProfile
        />
      )}

      {showDashboard && (
        <>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <WeeklySummary stats={stats} />
            </div>
            <div className="lg:col-span-1">
              <CoachQuickActions firstName={profile?.firstName} />
            </div>
          </div>

          <RecentActivity workouts={workouts ?? []} />
        </>
      )}
    </div>
  );
}

/**
 * Seven-day activity strip.
 *
 * Missed days are shown, not stored. Writing a "no activity" record
 * for every untrained day would mean thousands of empty documents per
 * user per year, and would make absence look like an event. Deriving
 * it from the log gives the same visibility at zero storage cost.
 */
function WeekStrip({ workouts }: { workouts: WorkoutEntry[] }) {
  const logged = new Set(workouts.map((workout) => workout.date));

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const offset = date.getTimezoneOffset() * 60_000;
    const iso = new Date(date.getTime() - offset).toISOString().slice(0, 10);
    return {
      iso,
      letter: date.toLocaleDateString(undefined, { weekday: "narrow" }),
      active: logged.has(iso),
      isToday: index === 6,
    };
  });

  return (
    <div className="flex items-end gap-1.5">
      {days.map((day) => (
        <div key={day.iso} className="flex flex-col items-center gap-1.5">
          <span
            className={cn(
              "font-mono text-[9px] uppercase tracking-wider",
              day.isToday ? "text-white/50" : "text-white/50",
            )}
          >
            {day.letter}
          </span>
          <span
            title={day.active ? `Trained ${day.iso}` : `No activity ${day.iso}`}
            className={cn(
              "size-2.5 rounded-full border transition-colors",
              day.active
                ? "border-[#CCFF00] bg-[#CCFF00]"
                : "border-white/15 bg-transparent",
              day.isToday && !day.active && "border-white/40",
            )}
          />
        </div>
      ))}
    </div>
  );
}

/** Time-of-day greeting, computed on the client (local time). */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function subline(isLoading: boolean, sessions: number): string {
  if (isLoading) return "Loading your training summary…";
  if (sessions === 0) return "No sessions logged in the last 7 days.";
  if (sessions === 1) return "One session logged this week — nice start.";
  return `${sessions} sessions logged this week.`;
}

/** Matches the real dashboard's geometry so the swap causes no shift. */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-6 lg:col-span-2">
          <Skeleton className="h-3 w-24 rounded bg-white/[0.06]" />
          <div className="mt-5 grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[84px] rounded-2xl bg-white/[0.06]" />
            ))}
          </div>
          <div className="mt-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full rounded bg-white/[0.06]" />
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-6">
          <Skeleton className="h-3 w-20 rounded bg-white/[0.06]" />
          <Skeleton className="mt-5 h-12 w-full rounded-xl bg-white/[0.06]" />
          <div className="mt-5 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-xl bg-white/[0.06]" />
            ))}
          </div>
          <Skeleton className="mt-5 h-11 w-full rounded-full bg-white/[0.06]" />
        </div>
      </div>

      <div className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-6">
        <Skeleton className="h-3 w-28 rounded bg-white/[0.06]" />
        <div className="mt-4 divide-y divide-white/[0.06]">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 py-3.5">
              <Skeleton className="size-10 shrink-0 rounded-xl bg-white/[0.06]" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5 rounded bg-white/[0.06]" />
                <Skeleton className="h-3 w-1/4 rounded bg-white/[0.06]" />
              </div>
              <Skeleton className="h-4 w-10 rounded bg-white/[0.06]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}