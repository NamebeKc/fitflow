// src/lib/plans.ts
import { collection, doc, getDoc, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { ActivityId } from "@/lib/profile";
import { ACTIVITIES, INTENSITIES, todayISO, type IntensityId } from "@/lib/workouts";

/**
 * ── STRUCTURED DAY PLANS ────────────────────────────────────────────
 * The coach writes prose for humans AND a machine-readable block for
 * the app:
 *
 *   <plan>{ "date": "2026-08-09", "exercises": [...] }</plan>
 *
 * The client strips that block out of the transcript, stores it, and
 * renders it as a tappable card. Regex-parsing prose would be
 * hopeless — "3 sets of 10" has a hundred spellings — so we ask for
 * the structure directly instead of guessing at it.
 *
 * Plans live at users/{uid}/plans/{yyyy-mm-dd}. Using the date as the
 * document ID enforces ONE plan per day at the storage layer: a second
 * plan for the same date overwrites the first rather than accumulating.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface PlanExercise {
  /** Common exercise name, e.g. "Squat". */
  name: string;
  /** Exact prescription: "3 × 10", "2 × 30s", "15 min". */
  prescription: string;
  /** Optional cue or modification. */
  note?: string;
}

export interface DayPlan {
  /** yyyy-mm-dd — also the Firestore document ID. */
  date: string;
  title: string;
  activity: ActivityId;
  estimatedMinutes: number;
  intensity: IntensityId;
  exercises: PlanExercise[];
  createdAt: string;
  /** Set once the plan has been logged as a workout. */
  completedWorkoutId?: string | null;
}

const PLAN_BLOCK = /<plan>([\s\S]*?)<\/plan>/i;

const VALID_ACTIVITIES = new Set<string>(
  ACTIVITIES.map((activity) => activity.id),
);
const VALID_INTENSITIES = new Set<string>(
  INTENSITIES.map((intensity) => intensity.id),
);

/**
 * Splits a coach reply into display text and a structured plan.
 *
 * Never throws: a malformed block is dropped and the prose still
 * renders. A plan card is a bonus, not a dependency — the coach's
 * answer must survive the app failing to understand it.
 */
export function extractPlan(reply: string): {
  text: string;
  plan: DayPlan | null;
} {
  const match = reply.match(PLAN_BLOCK);
  if (!match) return { text: reply, plan: null };

  const text = reply.replace(PLAN_BLOCK, "").trim();

  try {
    const raw = JSON.parse(match[1].trim()) as Partial<DayPlan>;
    const plan = normalizePlan(raw);
    return { text, plan };
  } catch (error) {
    console.error("[plans] Could not parse plan block:", error);
    return { text, plan: null };
  }
}

/** Rejects anything that wouldn't render or log correctly. */
function normalizePlan(raw: Partial<DayPlan>): DayPlan | null {
  if (!raw || typeof raw !== "object") return null;

  const date = typeof raw.date === "string" ? raw.date.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  // A plan for a day that has already passed cannot be trained, and
  // logging one would write a false record. The prompt forbids this;
  // this check is what makes it true rather than merely requested.
  if (date < todayISO()) return null;

  const seen = new Set<string>();

  const exercises = Array.isArray(raw.exercises)
    ? raw.exercises
        .filter(
          (exercise): exercise is PlanExercise =>
            Boolean(exercise) &&
            typeof exercise.name === "string" &&
            exercise.name.trim().length > 0 &&
            typeof exercise.prescription === "string" &&
            exercise.prescription.trim().length > 0,
        )
        .map((exercise) => ({
          name: exercise.name.trim(),
          prescription: exercise.prescription.trim(),
          ...(typeof exercise.note === "string" && exercise.note.trim()
            ? { note: exercise.note.trim() }
            : {}),
        }))
        // Two rows with the same name make a checklist ambiguous —
        // tick one and you can't tell which is done.
        .filter((exercise) => {
          const key = exercise.name.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 12)
    : [];

  if (exercises.length === 0) return null;

  const activity =
    typeof raw.activity === "string" && VALID_ACTIVITIES.has(raw.activity)
      ? (raw.activity as ActivityId)
      : ("bodyweight" as ActivityId);

  const intensity =
    typeof raw.intensity === "string" && VALID_INTENSITIES.has(raw.intensity)
      ? (raw.intensity as IntensityId)
      : ("moderate" as IntensityId);

  const minutes =
    typeof raw.estimatedMinutes === "number" &&
    Number.isFinite(raw.estimatedMinutes)
      ? Math.min(240, Math.max(5, Math.round(raw.estimatedMinutes)))
      : 30;

  return {
    date,
    title:
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : "Today's session",
    activity,
    estimatedMinutes: minutes,
    intensity,
    exercises,
    createdAt: new Date().toISOString(),
    completedWorkoutId: null,
  };
}

function plansCollection(uid: string) {
  return collection(db, "users", uid, "plans");
}

/** Writes the plan for its date, replacing any existing one. */
export async function savePlan(uid: string, plan: DayPlan): Promise<void> {
  await setDoc(doc(plansCollection(uid), plan.date), plan);
}

export async function loadPlan(
  uid: string,
  date: string,
): Promise<DayPlan | null> {
  try {
    const snapshot = await getDoc(doc(plansCollection(uid), date));
    return snapshot.exists() ? (snapshot.data() as DayPlan) : null;
  } catch (error) {
    console.error("[plans] Failed to load plan:", error);
    return null;
  }
}

/**
 * Loads several plans at once, keyed by date.
 *
 * Needed because a restored transcript rebuilds plan cards from the
 * message text, and that text has no idea whether the session was
 * ever logged. Without merging the STORED plan back in, every card
 * reappears as untouched after a reload — which is exactly what
 * happened: users were shown completed sessions as if they were new.
 */
export async function loadPlansForDates(
  uid: string,
  dates: string[],
): Promise<Map<string, DayPlan>> {
  const unique = Array.from(new Set(dates)).filter(Boolean);
  const found = new Map<string, DayPlan>();

  await Promise.all(
    unique.map(async (date) => {
      try {
        const snapshot = await getDoc(doc(plansCollection(uid), date));
        if (snapshot.exists()) {
          found.set(date, snapshot.data() as DayPlan);
        }
      } catch (error) {
        console.error("[plans] Failed to load plan for", date, error);
      }
    }),
  );

  return found;
}

/** Links a plan to the workout it produced, so the card can settle. */
export async function markPlanCompleted(
  uid: string,
  date: string,
  workoutId: string,
): Promise<void> {
  await setDoc(
    doc(plansCollection(uid), date),
    { completedWorkoutId: workoutId },
    { merge: true },
  );
}

/** "3 × 10 · Squat" style summary, used as workout notes. */
export function planToNotes(plan: DayPlan): string {
  return plan.exercises
    .map((exercise) => `• ${exercise.name} — ${exercise.prescription}`)
    .join("\n");
}