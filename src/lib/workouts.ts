// src/lib/workouts.ts
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { ACTIVITIES, type ActivityId } from "@/lib/profile";

/**
 * ── FIRESTORE PERSISTENCE ────────────────────────────────────────────
 * Workouts live at `users/{uid}/workouts/{workoutId}` — a subcollection
 * under each user's document, so the security rules cascade naturally.
 * Functions take a `uid`, return Promises, and add/delete return the
 * refreshed list so pages can do `setWorkouts(await addWorkout(...))`.
 *
 * Sorting stays client-side (small collections, and it avoids Firestore
 * composite-index setup for the two-field ordering).
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * One movement within a strength session.
 *
 * Free-text notes were the only record of what was actually lifted,
 * which meant the coach could see "Weightlifting, 45 min, hard" and
 * nothing more — so progressive overload on a manually logged session
 * was guesswork. Structured sets are what let it say "you squatted
 * 3 × 8 at 60kg last Tuesday, let's go for 3 × 10".
 */
export interface StrengthSet {
  /** Movement name, e.g. "Squat". */
  exercise: string;
  sets: number;
  reps: number;
  /** Load in kg. Omitted for bodyweight movements. */
  weightKg?: number;
}

export interface WorkoutEntry {
  id: string;
  activity: ActivityId;
  title: string;
  /** ISO date string (yyyy-mm-dd) of when the workout happened. */
  date: string;
  durationMin: number;
  intensity: IntensityId;
  /** Free text: how it felt, anything the structured fields miss. */
  notes: string;
  /**
   * Structured strength work. Optional — a walk has none, and older
   * entries predate the field.
   */
  strength?: StrengthSet[];
  /**
   * Steps, entered by hand.
   *
   * MANUAL IS THE PERMANENT ANSWER, NOT A STOPGAP. Two independent
   * walls close every automatic route:
   *
   *   Technical — a PWA cannot read the phone's pedometer.
   *   `DeviceMotionEvent` only counts while the page is open and in
   *   the foreground; HealthKit and Health Connect are on-device
   *   native APIs with no web or server endpoint; Google Fit's REST
   *   API closed to new developers in May 2024 and is being retired.
   *
   *   Contractual — Strava's API Policy (effective 1 June 2026) §5.3
   *   bars Strava data from "the development, training, evaluation, or
   *   operation of any AI Application", naming RAG and context-window
   *   ingestion specifically, and §5.4 bars combining it with other
   *   customer data. An AI coach reading imported activities is the
   *   prohibited case, not an edge of it.
   *
   * Of the web-reachable providers only Garmin permits AI processing
   * outright, and its device base among our users is near zero. So this
   * stays a number people copy from the health app they already have,
   * rather than a counter that silently undercounts whenever the
   * screen locks.
   *
   * The only route to verified activity is a native Android shell
   * reading Health Connect. Revisit if an HMO makes it a condition.
   */
  steps?: number;
  createdAt: string; // ISO timestamp
}

export const INTENSITIES = [
  { id: "easy", label: "Easy" },
  { id: "moderate", label: "Moderate" },
  { id: "hard", label: "Hard" },
] as const;

export type IntensityId = (typeof INTENSITIES)[number]["id"];

/** Activities where logging sets, reps, and load is worth offering. */
const STRENGTH_ACTIVITIES: ActivityId[] = [
  "weightlifting",
  "bodyweight",
  "hiit",
];

/** Activities where a step count is meaningful. */
const STEP_ACTIVITIES: ActivityId[] = ["walking", "running"];

export function usesStrengthDetail(activity: ActivityId | null): boolean {
  return activity !== null && STRENGTH_ACTIVITIES.includes(activity);
}

export function usesStepCount(activity: ActivityId | null): boolean {
  return activity !== null && STEP_ACTIVITIES.includes(activity);
}

/** "Squat 3 × 10 @ 60kg" — used in summaries and coach context. */
export function formatStrengthSet(set: StrengthSet): string {
  const base = `${set.exercise} ${set.sets} × ${set.reps}`;
  return set.weightKg ? `${base} @ ${set.weightKg}kg` : base;
}

/** Re-exported so log components have a single import source. */
export { ACTIVITIES, type ActivityId };

function workoutsCollection(uid: string) {
  return collection(db, "users", uid, "workouts");
}

export async function loadWorkouts(uid: string): Promise<WorkoutEntry[]> {
  try {
    const snapshot = await getDocs(workoutsCollection(uid));
    return sortWorkouts(
      snapshot.docs.map((docSnapshot) => docSnapshot.data() as WorkoutEntry),
    );
  } catch (error) {
    console.error("Failed to load workouts:", error);
    return [];
  }
}

export async function addWorkout(
  uid: string,
  entry: WorkoutEntry,
): Promise<WorkoutEntry[]> {
  await setDoc(doc(db, "users", uid, "workouts", entry.id), entry);
  return loadWorkouts(uid);
}

export async function deleteWorkout(
  uid: string,
  id: string,
): Promise<WorkoutEntry[]> {
  await deleteDoc(doc(db, "users", uid, "workouts", id));
  return loadWorkouts(uid);
}

/** Newest workout date first; ties broken by log time. */
function sortWorkouts(entries: WorkoutEntry[]): WorkoutEntry[] {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

export function intensityLabel(id: IntensityId): string {
  return INTENSITIES.find((intensity) => intensity.id === id)?.label ?? id;
}

/** Returns today's date as yyyy-mm-dd in local time (for date inputs). */
export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}