// src/lib/profile.ts
import { doc, getDoc, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

/**
 * ── FIRESTORE PERSISTENCE ────────────────────────────────────────────
 * Profiles live at `users/{uid}`. Access control lives in Firestore
 * security rules: users can only read and write their own document.
 *
 * `environment` and `equipment` are OPTIONAL. Accounts created before
 * these existed simply don't have them, and nothing should break —
 * the coach asks conversationally when it needs to know, rather than
 * forcing everyone back through onboarding.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface UserProfile {
  firstName: string;
  age: number;
  weightKg: number;
  /** Height in cm. Optional — asked once, used for load calibration. */
  heightCm?: number;
  /**
   * @deprecated Written by versions that allowed a single goal. Still
   * present on every profile created before multi-goal shipped — read
   * through `profileGoals()`, never directly.
   */
  goal?: GoalId;
  /**
   * Up to `MAX_GOALS`, in priority order: the first drives how a
   * session is actually shaped, the rest are served across the week.
   */
  goals?: GoalId[];
  activities: ActivityId[];
  /** Where they train. Optional — absent on older profiles. */
  environment?: EnvironmentId[];
  /** What they can train with. Optional; empty implies bodyweight only. */
  equipment?: EquipmentId[];
  /** How they want to be spoken to. Optional; defaults to balanced. */
  coachingStyle?: CoachingStyleId;
  /**
   * How active they were BEFORE AdimFit, self-reported.
   *
   * Optional, and captured in-app rather than during onboarding, so
   * most profiles will not have it. Absent is a real and expected
   * value — never treat it as zero.
   *
   * WHY IT EXISTS. Insurer evidence is consistent that healthcare
   * savings concentrate in members who move from inactive to active,
   * not in members who were already training. Without a baseline
   * there is no way to identify that group, and "our users are
   * active" is the selection effect an actuary discounts to nothing.
   * Recorded once and never overwritten: the answer is about a fixed
   * point in the past, so a later edit could only make it less true.
   */
  baselineActiveDays?: BaselineActivityId;
  /** When the baseline was answered. Recall degrades; this dates it. */
  baselineCapturedAt?: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export const GOALS = [
  { id: "strength", label: "Build strength" },
  { id: "weight-loss", label: "Lose weight" },
  { id: "endurance", label: "Improve endurance" },
  { id: "mobility", label: "Improve mobility" },
  { id: "general", label: "General fitness" },
] as const;

export type GoalId = (typeof GOALS)[number]["id"];

/**
 * Two, not more.
 *
 * A week holds three or four sessions. Three priorities across four
 * sessions means none of them gets a block long enough to adapt to,
 * and the coach loses the thing that makes it feel like coaching — a
 * reason for today's session to be this one. Two is the most that can
 * be served honestly: one shapes the session, the other gets its own
 * day.
 */
export const MAX_GOALS = 2;

/**
 * Self-reported activity before joining, in days per week.
 *
 * Deliberately coarse. A four-way split is answerable in one tap from
 * memory; asking for a number invites a guess dressed up as precision,
 * and the literature on self-reported activity is unkind enough
 * already.
 */
export const BASELINE_ACTIVITY = [
  { id: "none", label: "Barely at all" },
  { id: "1-2", label: "1–2 days" },
  { id: "3-4", label: "3–4 days" },
  { id: "5+", label: "5+ days" },
] as const;

export type BaselineActivityId = (typeof BASELINE_ACTIVITY)[number]["id"];

/**
 * The one way to read a profile's goals.
 *
 * Profiles exist in two shapes — `goal` as a bare string on older
 * documents, `goals` as an ordered array on newer ones. Reading either
 * field directly gets one of those two populations wrong, silently, on
 * a field the coach consults for every single message.
 */
export function profileGoals(
  profile: Pick<UserProfile, "goal" | "goals"> | null | undefined,
): GoalId[] {
  if (!profile) return [];
  if (profile.goals && profile.goals.length > 0) {
    return profile.goals.slice(0, MAX_GOALS);
  }
  return profile.goal ? [profile.goal] : [];
}

export const ACTIVITIES = [
  { id: "running", label: "Running" },
  { id: "walking", label: "Walking" },
  { id: "cycling", label: "Cycling" },
  { id: "weightlifting", label: "Weightlifting" },
  { id: "bodyweight", label: "Bodyweight training" },
  { id: "swimming", label: "Swimming" },
  { id: "yoga", label: "Yoga & stretching" },
  { id: "hiit", label: "HIIT" },
] as const;

export type ActivityId = (typeof ACTIVITIES)[number]["id"];

/**
 * Multi-select by design — "both" is the common case, and a single
 * "Gym / Home / Both" picker collapses badly the moment someone also
 * runs outdoors or travels for work.
 */
export const ENVIRONMENTS = [
  { id: "gym", label: "A gym" },
  { id: "home", label: "At home" },
  { id: "outdoors", label: "Outdoors" },
  { id: "travel", label: "While travelling" },
] as const;

export type EnvironmentId = (typeof ENVIRONMENTS)[number]["id"];

/**
 * Deliberately short. A thirty-item inventory reads like tax
 * paperwork and adds little programming value over these eight.
 */
export const EQUIPMENT = [
  { id: "none", label: "Nothing — bodyweight" },
  { id: "dumbbells", label: "Dumbbells" },
  { id: "bands", label: "Resistance bands" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "pullup-bar", label: "Pull-up bar" },
  { id: "bench", label: "Bench" },
  { id: "mat", label: "Yoga mat" },
  { id: "cardio-machine", label: "Cardio machine" },
] as const;

export type EquipmentId = (typeof EQUIPMENT)[number]["id"];

/**
 * True when we should ask about equipment at all.
 *
 * Someone who only trains at a commercial gym has everything; asking
 * them to inventory it is busywork. The question only earns its place
 * when they train somewhere they had to equip themselves.
 */
/**
 * Coaching voice.
 *
 * The same session can land as encouragement or as a challenge, and
 * which one works is a matter of temperament, not fitness level. This
 * changes tone and framing ONLY — never the safety rules, the load
 * prescribed, or the willingness to back off when something hurts.
 */
export const COACHING_STYLES = [
  {
    id: "gentle",
    label: "Gentle guide",
    description: "Patient and encouraging. Good if the gym makes you anxious.",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Warm but direct. The default.",
  },
  {
    id: "drill",
    label: "Push me hard",
    description: "Blunt, high-energy, holds you to it.",
  },
] as const;

export type CoachingStyleId = (typeof COACHING_STYLES)[number]["id"];

export function coachingStyleLabel(id: CoachingStyleId): string {
  return COACHING_STYLES.find((style) => style.id === id)?.label ?? id;
}

/**
 * Body mass index.
 *
 * Returned for COACHING CALIBRATION ONLY — it informs impact choices
 * and load starting points. It is deliberately not surfaced to users
 * as a category or a verdict.
 *
 * BMI is a population statistic and a poor individual measure: it
 * cannot distinguish muscle from fat, so trained people routinely
 * read as "overweight". Treating it as a judgement about a person is
 * both inaccurate and harmful, which is why nothing in the UI renders
 * it and the coach is instructed never to volunteer it.
 */
export function calculateBmi(
  weightKg: number,
  heightCm: number | undefined,
): number | null {
  if (!heightCm || heightCm < 100 || heightCm > 250) return null;
  const metres = heightCm / 100;
  const bmi = weightKg / (metres * metres);
  return Number.isFinite(bmi) ? Math.round(bmi * 10) / 10 : null;
}

export function needsEquipmentQuestion(
  environment: EnvironmentId[],
): boolean {
  return environment.some((id) => id !== "gym");
}

export async function loadProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snapshot = await getDoc(doc(db, "users", uid));
    return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
  } catch (error) {
    console.error("Failed to load profile:", error);
    return null;
  }
}

export async function saveProfile(
  uid: string,
  profile: UserProfile,
): Promise<void> {
  await setDoc(doc(db, "users", uid), profile);
}

/** Convenience lookups for rendering saved profiles. */
export function goalLabel(id: GoalId): string {
  return GOALS.find((goal) => goal.id === id)?.label ?? id;
}

export function activityLabel(id: ActivityId): string {
  return ACTIVITIES.find((activity) => activity.id === id)?.label ?? id;
}

export function environmentLabel(id: EnvironmentId): string {
  return ENVIRONMENTS.find((environment) => environment.id === id)?.label ?? id;
}

export function equipmentLabel(id: EquipmentId): string {
  return EQUIPMENT.find((equipment) => equipment.id === id)?.label ?? id;
}