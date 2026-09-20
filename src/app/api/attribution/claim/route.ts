// src/app/api/attribution/claim/route.ts
import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

/**
 * ── CLAIMING AN ATTRIBUTION ─────────────────────────────────────────
 * Turns a browser's localStorage claim into a server record, once.
 *
 * WHY THIS IS NOT STORED ON `users/{uid}`. Three separate reasons, any
 * one of which is disqualifying:
 *
 * 1. `loadProfile()` treats the existence of `users/{uid}` as "this
 *    person has completed onboarding". Writing attribution there
 *    before the wizard runs would create the document early, and every
 *    referred signup would skip onboarding entirely — landing on a
 *    profile screen with no name, age or goal.
 *
 * 2. `saveProfile()` uses `setDoc` WITHOUT merge — a full overwrite.
 *    Finishing onboarding would erase the attribution field, so the
 *    bounty would vanish at exactly the moment the user became real.
 *
 * 3. `users/{uid}` is writable by its owner. Attribution decides who
 *    gets paid; a field a user can edit is a field a user can forge.
 *
 * `attributions/{uid}` is server-only (see firestore.rules) and
 * touched by nothing else.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Matches the client default; the partner's terms override it. */
const DEFAULT_WINDOW_DAYS = 60;
const DAY_MS = 86_400_000;

interface ClaimBody {
  referralCode?: string | null;
  cohort?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  heroVariant?: string | null;
}

/** Bounded, lower-cased, or null. Never trust a browser string. */
function clean(value: unknown, maxLength = 64): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase().slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json(
      { error: "Your session has expired. Please sign in again." },
      { status: 401 },
    );
  }

  let body: ClaimBody;
  try {
    body = (await request.json()) as ClaimBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const db = getAdminDb();
  const attributionRef = db.doc(`attributions/${uid}`);

  try {
    const written = await db.runTransaction(async (tx) => {
      // ── Reads first. Firestore rejects a transaction that reads
      //    after it writes, so every get happens up here. ──────────
      const existing = await tx.get(attributionRef);
      if (existing.exists) return false; // write-once

      const claimed = clean(body.referralCode);

      // A code only counts if it resolves to a partner we are actually
      // running. Anything else is stored as organic — the campaign
      // fields are still worth keeping for the funnel.
      let referralCode: string | null = null;
      let windowDays = DEFAULT_WINDOW_DAYS;

      if (claimed) {
        const partner = await tx.get(db.doc(`partners/${claimed}`));
        if (partner.exists && partner.get("status") === "active") {
          referralCode = claimed;
          windowDays =
            partner.get("terms.attributionWindowDays") ?? DEFAULT_WINDOW_DAYS;
        }
      }

      // ── Writes ────────────────────────────────────────────────────
      const now = Timestamp.now();
      tx.create(attributionRef, {
        uid,
        referralCode,
        cohort: clean(body.cohort),
        utmSource: clean(body.utmSource),
        utmMedium: clean(body.utmMedium),
        utmCampaign: clean(body.utmCampaign),
        heroVariant: clean(body.heroVariant),
        firstTouchAt: now,
        attributionExpiresAt: Timestamp.fromMillis(
          now.toMillis() + windowDays * DAY_MS,
        ),
      });

      if (referralCode) {
        tx.update(db.doc(`partners/${referralCode}`), {
          "counters.signups": FieldValue.increment(1),
        });
      }

      return true;
    });

    return NextResponse.json({ ok: true, written });
  } catch (error) {
    // Never fail the caller's sign-in over this.
    console.error("[attribution/claim] Failed:", error);
    return NextResponse.json({ ok: false, written: false }, { status: 200 });
  }
}
