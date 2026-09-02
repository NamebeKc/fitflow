// src/lib/stats.ts
import { activityLabel, type ActivityId } from "@/lib/profile";
import { todayISO, type WorkoutEntry } from "@/lib/workouts";

/**
 * ── DERIVED STATS ────────────────────────────────────────────────────
 * Pure functions: workout entries in, numbers out. No storage, no
 * network, no React — which makes them trivial to reason about and
 * reuse (the AI coach could summarize from these later).
 *
 * "This week" means the last 7 days INCLUDING today, which is what
 * people intuitively mean when they ask how their week is going.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface WeeklyStats {
  sessions: number;
  minutes: number;
  /** Consecutive days ending today (or yesterday) with a logged workout. */
  streakDays: number;
  /** Activity totals for the week, busiest first. */
  breakdown: Array<{
    activity: ActivityId;
    label: string;
    minutes: number;
    sessions: number;
  }>;
}

/** yyyy-mm-dd for `daysAgo` days before today, in local time. */
function isoDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function computeWeeklyStats(workouts: WorkoutEntry[]): WeeklyStats {
  const weekStart = isoDaysAgo(6); // 7-day window including today
  const thisWeek = workouts.filter((workout) => workout.date >= weekStart);

  const minutes = thisWeek.reduce(
    (total, workout) => total + workout.durationMin,
    0,
  );

  // Group the week's minutes and sessions by activity.
  const byActivity = new Map<ActivityId, { minutes: number; sessions: number }>();
  for (const workout of thisWeek) {
    const current = byActivity.get(workout.activity) ?? {
      minutes: 0,
      sessions: 0,
    };
    byActivity.set(workout.activity, {
      minutes: current.minutes + workout.durationMin,
      sessions: current.sessions + 1,
    });
  }

  const breakdown = [...byActivity.entries()]
    .map(([activity, totals]) => ({
      activity,
      label: activityLabel(activity),
      ...totals,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    sessions: thisWeek.length,
    minutes,
    streakDays: computeStreak(workouts),
    breakdown,
  };
}

/**
 * Counts back day by day from today for consecutive days with a logged
 * workout. A workout today OR yesterday keeps a streak alive — so the
 * number doesn't reset to zero the moment someone wakes up.
 */
export function computeStreak(workouts: WorkoutEntry[]): number {
  if (workouts.length === 0) return 0;

  const loggedDates = new Set(workouts.map((workout) => workout.date));
  const today = todayISO();

  // Start from today if it has a workout, otherwise from yesterday.
  let cursor = loggedDates.has(today) ? 0 : 1;
  if (!loggedDates.has(isoDaysAgo(cursor))) return 0;

  let streak = 0;
  while (loggedDates.has(isoDaysAgo(cursor))) {
    streak += 1;
    cursor += 1;
  }
  return streak;
}

/** "7 workouts · 95 min" style summary for the whole log. */
export function computeAllTime(workouts: WorkoutEntry[]) {
  return {
    sessions: workouts.length,
    minutes: workouts.reduce(
      (total, workout) => total + workout.durationMin,
      0,
    ),
  };
}