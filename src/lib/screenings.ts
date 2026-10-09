// src/lib/screenings.ts
import {
  collection,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

/**
 * ── FREE HEALTH SCREENINGS ──────────────────────────────────────────
 * A curated directory of free screening events near the user. Read-only
 * to every client; entries are reviewed by a human before they publish.
 *
 * ── WHY CURATED AND NOT SCRAPED STRAIGHT TO USERS ───────────────────
 * Two findings drove this.
 *
 * First, the open web is retrospective. Nigerian coverage of these
 * events is overwhelmingly written AFTER they happen — "400 Lagosians
 * were screened" — while the announcements that would actually be
 * useful live on Instagram, WhatsApp and church notices. A scraper
 * pointed at the news would mostly publish events that are already
 * over, which is worse than an empty list.
 *
 * Second, the failure mode is not a bad row in a table. Someone spends
 * money and half a day travelling to a venue on our say-so. A listing
 * that is wrong, cancelled, or fraudulent costs them that, and we own
 * it. So a human verifies every entry, every card carries its source
 * and a verification date, and nothing publishes itself.
 *
 * ── WHY EXPIRE RATHER THAN DELETE ───────────────────────────────────
 * The instinct to delete stale entries is right about freshness and
 * wrong about records. For anything health-adjacent the one question
 * worth being able to answer is "what did the app show this person, and
 * when". So `status` flips to `expired` at `endsAt` and clients only
 * ever read `published`; the row itself is purged later, on a schedule.
 *
 * ── WHY AREA AND NOT GPS ────────────────────────────────────────────
 * These events are advertised at area granularity — "General Hospital
 * Somolu" — so metre accuracy buys nothing. Asking for geolocation
 * would cost a permission prompt at a bad moment, put precise location
 * under the NDPA, and forfeit a privacy claim the app currently makes.
 * The user names their state once, and can change or clear it.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Only `published` is ever served to a client. */
export type ScreeningStatus = "draft" | "published" | "cancelled" | "expired";

export type ScreeningType =
  | "blood_pressure"
  | "blood_sugar"
  | "bmi"
  | "eye"
  | "dental"
  | "hepatitis"
  | "hiv"
  | "cancer"
  | "general";

export interface Screening {
  id: string;
  title: string;
  /** Who is running it, as they name themselves. */
  organiser: string;
  types: ScreeningType[];
  /** Nigerian state, from `NIGERIAN_STATES`. The query key. */
  state: string;
  /** LGA or neighbourhood, free text. Refines display, not the query. */
  area?: string;
  venue: string;
  /** ISO date-time the event opens. */
  startsAt: string;
  /** ISO date-time it closes. Drives expiry. */
  endsAt: string;
  /** False would be a paid clinic; those do not belong in this list. */
  free: true;
  /**
   * Where the announcement came from. NON-OPTIONAL BY DESIGN: a
   * listing a user cannot check for themselves is a claim we are
   * making rather than information we are passing on.
   */
  sourceUrl: string;
  sourceName: string;
  /** ISO date a human last confirmed this entry. Shown on the card. */
  verifiedAt: string;
  status: ScreeningStatus;
  /** Anything a reader needs that the fields above do not carry. */
  notes?: string;
}

/**
 * The 36 states plus the FCT.
 *
 * A fixed list rather than free text, because it is the query key and
 * "Lagos"/"lagos"/"Lagos State" would silently fragment the index. The
 * 774 LGAs are deliberately NOT enumerated — `area` stays free text, so
 * people can write the name they actually use for where they live.
 */
export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT — Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

export const SCREENING_TYPE_LABELS: Record<ScreeningType, string> = {
  blood_pressure: "Blood pressure",
  blood_sugar: "Blood sugar",
  bmi: "BMI",
  eye: "Eye",
  dental: "Dental",
  hepatitis: "Hepatitis",
  hiv: "HIV",
  cancer: "Cancer",
  general: "General check-up",
};

/**
 * The line shown under every list. Not decoration — it is the honest
 * description of what this directory is and is not.
 */
export const SCREENING_DISCLAIMER =
  "Compiled from public announcements and checked by hand. Details change: confirm with the organiser before you travel.";

/**
 * Upcoming published screenings in a state, soonest first.
 *
 * Filtered on `endsAt` rather than `startsAt` so a multi-day outreach
 * still appears on its second day. `status` is checked as well as the
 * date because the expiry job is a schedule, not a guarantee — a
 * cancelled event must disappear the moment it is marked, not at the
 * next sweep.
 */
export async function loadScreenings(
  state: string,
  max = 20,
): Promise<Screening[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "screenings"),
      where("state", "==", state),
      where("status", "==", "published"),
      where("endsAt", ">=", new Date().toISOString()),
      orderBy("endsAt", "asc"),
      fsLimit(max),
    ),
  );

  return snapshot.docs.map(
    (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Screening,
  );
}

/** "Today", "Tomorrow", or a short date — how people think about it. */
export function whenLabel(startsAt: string, now: Date = new Date()): string {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "";

  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const days = Math.round(
    (startDay.getTime() - today.getTime()) / 86_400_000,
  );

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 7) {
    return start.toLocaleDateString(undefined, { weekday: "long" });
  }
  return start.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * How long ago a human checked this entry.
 *
 * Shown on every card rather than hidden, because the age of the check
 * is the single most useful thing a reader can weigh when deciding
 * whether to phone ahead.
 */
export function verifiedLabel(verifiedAt: string, now: Date = new Date()): string {
  const checked = new Date(verifiedAt);
  if (Number.isNaN(checked.getTime())) return "unverified";

  const days = Math.floor((now.getTime() - checked.getTime()) / 86_400_000);
  if (days <= 0) return "checked today";
  if (days === 1) return "checked yesterday";
  if (days < 14) return `checked ${days} days ago`;
  return `checked ${Math.floor(days / 7)} weeks ago`;
}
