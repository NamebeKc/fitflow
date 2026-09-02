// src/lib/measurements.ts
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { WorkoutEntry } from "@/lib/workouts";

/**
 * ── MEASUREMENTS & ACHIEVEMENTS ─────────────────────────────────────
 * Two things live here, and the split between them is deliberate.
 *
 * WEIGHT is tracked and charted as INFORMATION. It is never scored,
 * never streaked, never rewarded. Weight moves 2-3kg on water, salt,
 * and sleep alone, so rewarding its movement means handing out
 * rewards uncorrelated with effort — demotivating at best, and at
 * worst it rewards restriction, which is the mechanism behind
 * disordered eating.
 *
 * ACHIEVEMENTS are earned on BEHAVIOUR the user controls: sessions
 * completed, consistency, progression, variety. That is what a person
 * can actually repeat tomorrow, which is what makes a habit.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface Measurement {
  /** yyyy-mm-dd — also the document ID, so one entry per day. */
  date: string;
  weightKg: number;
  createdAt: string;
}

function measurementsCollection(uid: string) {
  return collection(db, "users", uid, "measurements");
}

/** Records a weigh-in, replacing any earlier entry for the same day. */
export async function saveMeasurement(
  uid: string,
  weightKg: number,
  date: string,
): Promise<void> {
  const entry: Measurement = {
    date,
    weightKg,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(measurementsCollection(uid), date), entry);
}

/** Weigh-ins, oldest first, ready to chart. */
export async function loadMeasurements(uid: string): Promise<Measurement[]> {
  const snapshot = await getDocs(
    query(measurementsCollection(uid), orderBy("date", "asc")),
  );
  return snapshot.docs.map((docSnapshot) => docSnapshot.data() as Measurement);
}

/**
 * Whether to invite a weigh-in.
 *
 * Deliberately infrequent, and an INVITATION rather than a demand.
 * Daily weighing prompts are a documented trigger for disordered
 * eating, and daily numbers are mostly noise anyway — meaningful
 * change takes weeks. Fortnightly is enough to show a trend without
 * inviting anyone to fixate.
 */
export function shouldInviteWeighIn(
  measurements: Measurement[],
  today: string,
): boolean {
  if (measurements.length === 0) return false; // never nag a new user
  const latest = measurements[measurements.length - 1];
  return daysBetween(latest.date, today) >= 14;
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

/* ══ Achievements — behaviour only ════════════════════════════════ */

export interface Achievement {
  id: string;
  title: string;
  description: string;
  /** Current progress toward `target`. */
  progress: number;
  target: number;
  earned: boolean;
}

/**
 * Derives achievements from the workout log.
 *
 * Nothing is stored: these are computed on read, so they can never
 * drift out of sync with the underlying data, and changing the rules
 * never requires a migration.
 */
export function computeAchievements(
  workouts: WorkoutEntry[],
  today: string,
): Achievement[] {
  const sessions = workouts.length;
  const totalMinutes = workouts.reduce(
    (sum, workout) => sum + workout.durationMin,
    0,
  );
  const distinctActivities = new Set(
    workouts.map((workout) => workout.activity),
  ).size;
  const currentStreak = computeWeekStreak(workouts, today);

  const define = (
    id: string,
    title: string,
    description: string,
    progress: number,
    target: number,
  ): Achievement => ({
    id,
    title,
    description,
    progress: Math.min(progress, target),
    target,
    earned: progress >= target,
  });

  return [
    define(
      "first-session",
      "First session",
      "Log your first workout.",
      sessions,
      1,
    ),
    define(
      "ten-sessions",
      "Ten in the bank",
      "Ten logged sessions. The habit is forming.",
      sessions,
      10,
    ),
    define(
      "fifty-sessions",
      "Fifty deep",
      "Fifty sessions logged. This is a practice now.",
      sessions,
      50,
    ),
    define(
      "consistency-4",
      "Four weeks running",
      "Train at least twice a week, four weeks in a row.",
      currentStreak,
      4,
    ),
    define(
      "consistency-12",
      "A season of work",
      "Twelve consecutive weeks of training.",
      currentStreak,
      12,
    ),
    define(
      "variety",
      "Well rounded",
      "Log four different activity types.",
      distinctActivities,
      4,
    ),
    define(
      "thousand-minutes",
      "A thousand minutes",
      "Accumulate 1,000 minutes of training.",
      totalMinutes,
      1000,
    ),
  ];
}

/**
 * Consecutive weeks containing at least two sessions.
 *
 * Weeks rather than days on purpose: a day-streak punishes rest, and
 * rest is part of training. This rewards showing up regularly while
 * leaving room to recover.
 */
export function computeWeekStreak(
  workouts: WorkoutEntry[],
  today: string,
): number {
  if (workouts.length === 0) return 0;

  const dates = workouts.map((workout) => workout.date).sort();
  const end = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(end)) return 0;

  let streak = 0;

  for (let week = 0; week < 104; week += 1) {
    const weekEnd = end - week * 7 * 86_400_000;
    const weekStart = weekEnd - 6 * 86_400_000;

    const count = dates.filter((date) => {
      const time = Date.parse(`${date}T00:00:00Z`);
      return time >= weekStart && time <= weekEnd;
    }).length;

    if (count >= 2) {
      streak += 1;
    } else if (week > 0) {
      // The current week is still in progress, so a thin week zero
      // shouldn't break a streak that's otherwise intact.
      break;
    }
  }

  return streak;
}