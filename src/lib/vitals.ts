// src/lib/vitals.ts
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

/**
 * ── BLOOD PRESSURE ──────────────────────────────────────────────────
 * Optional, self-entered, and kept in its own collection rather than
 * folded into `measurements`.
 *
 * WHY A SEPARATE COLLECTION. Weight and blood pressure look similar —
 * a number, dated, charted — and are completely different things.
 * Weight is a body metric that never leaves the device owner's own
 * screens. Blood pressure is health data with a different consent
 * story: it is the one measure a wellness programme's evidence
 * actually turns on, so it is the field most likely to be exported,
 * one day, with explicit permission, to an HMO. Different lifecycle,
 * different consent, different collection. Merging them would mean
 * untangling that later under pressure.
 *
 * WHY IT EXISTS AT ALL. With no wearable integration available
 * (`workouts.ts` explains why that is permanent), self-reported
 * activity cannot carry a clinical claim — the BJ's Wholesale trial is
 * the cautionary case, where self-reported exercise rose 8.3pp with no
 * change in any biometric. Blood pressure is the marker exercise moves
 * most directly: across 93 RCTs, endurance training lowered it by
 * 8.3/5.2 mmHg in hypertensive adults. It is also measured by the HMO
 * itself at an annual screening, which sidesteps the healthy-user
 * objection entirely.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not diagnose. A single
 * self-taken reading on an unvalidated home monitor is not a diagnosis
 * of anything, and telling someone they are hypertensive on that basis
 * would be both wrong and harmful. The app shows the number, shows the
 * trend, and — only on a sustained pattern — suggests a conversation
 * with a clinician. See `bloodPressureNote()`.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface VitalsEntry {
  /** yyyy-mm-dd — also the document ID, so one entry per day. */
  date: string;
  /** mmHg, the upper number. */
  systolic: number;
  /** mmHg, the lower number. */
  diastolic: number;
  /** Optional resting pulse, bpm. */
  pulse?: number;
  createdAt: string;
}

/**
 * Plausible ranges for a human reading, used to reject typos rather
 * than to judge health. A systolic of 12 is a mis-key; a systolic of
 * 180 is real and must be accepted, because refusing it is exactly
 * when the number matters most.
 */
export const SYSTOLIC_RANGE = { min: 70, max: 260 } as const;
export const DIASTOLIC_RANGE = { min: 40, max: 160 } as const;
export const PULSE_RANGE = { min: 30, max: 220 } as const;

/** How many recent readings a sustained pattern needs before we speak. */
const PATTERN_READINGS = 3;

/**
 * The threshold at which repeated readings warrant a clinician.
 *
 * 140/90 is the long-standing office-measurement threshold for stage 1
 * hypertension used by WHO and in Nigerian practice. The US 2017
 * ACC/AHA guideline sets a lower bar (130/80); we use the higher one
 * deliberately, because the cost of a false alarm delivered by a
 * fitness app to someone with no clinician is real.
 */
const ELEVATED = { systolic: 140, diastolic: 90 } as const;

function vitalsCollection(uid: string) {
  return collection(db, "users", uid, "vitals");
}

export function isPlausibleReading(systolic: number, diastolic: number): boolean {
  return (
    Number.isFinite(systolic) &&
    Number.isFinite(diastolic) &&
    systolic >= SYSTOLIC_RANGE.min &&
    systolic <= SYSTOLIC_RANGE.max &&
    diastolic >= DIASTOLIC_RANGE.min &&
    diastolic <= DIASTOLIC_RANGE.max &&
    // A diastolic at or above systolic is a transposed entry, not a
    // person. Catching it here saves a nonsensical chart.
    diastolic < systolic
  );
}

/** Records a reading, replacing any earlier entry for the same day. */
export async function saveVitals(
  uid: string,
  reading: Omit<VitalsEntry, "createdAt">,
): Promise<void> {
  const entry: VitalsEntry = {
    ...reading,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(vitalsCollection(uid), reading.date), entry);
}

/** Readings, oldest first, ready to chart. */
export async function loadVitals(uid: string): Promise<VitalsEntry[]> {
  const snapshot = await getDocs(
    query(vitalsCollection(uid), orderBy("date", "asc")),
  );
  return snapshot.docs.map((docSnap) => docSnap.data() as VitalsEntry);
}

export type BloodPressureNote =
  | { kind: "none" }
  | { kind: "sustained-high"; message: string }
  | { kind: "single-very-high"; message: string };

/**
 * What, if anything, to say about a set of readings.
 *
 * THE RULES ARE CONSERVATIVE ON PURPOSE.
 *
 * - Nothing is said about one ordinary reading. Blood pressure varies
 *   with caffeine, stress, a cuff on the wrong arm, and having just
 *   climbed stairs. One number means very little.
 * - A sustained pattern — the last three readings at or above 140/90 —
 *   is worth raising, once, as a suggestion to see someone qualified.
 * - A single reading at or above 180/120 is the one exception, because
 *   that range is treated as urgent regardless of history, and saying
 *   nothing would be the harmful choice.
 *
 * In every case the wording suggests a clinician. It never names a
 * condition, never estimates risk, and never recommends treatment.
 */
export function bloodPressureNote(readings: VitalsEntry[]): BloodPressureNote {
  if (readings.length === 0) return { kind: "none" };

  const latest = readings[readings.length - 1];
  if (latest.systolic >= 180 || latest.diastolic >= 120) {
    return {
      kind: "single-very-high",
      message:
        "That reading is high enough to be worth checking today. Sit for five minutes and measure again — if it stays there, contact a doctor or pharmacist rather than waiting.",
    };
  }

  const recent = readings.slice(-PATTERN_READINGS);
  if (recent.length < PATTERN_READINGS) return { kind: "none" };

  const allElevated = recent.every(
    (r) => r.systolic >= ELEVATED.systolic || r.diastolic >= ELEVATED.diastolic,
  );
  if (!allElevated) return { kind: "none" };

  return {
    kind: "sustained-high",
    message:
      "Your last three readings have been at or above 140/90. That is not a diagnosis — home monitors vary and so does blood pressure — but it is worth a conversation with a doctor or pharmacist, who can measure it properly.",
  };
}

/** `128/82` — the conventional way people read the pair aloud. */
export function formatReading(entry: VitalsEntry): string {
  return `${entry.systolic}/${entry.diastolic}`;
}
