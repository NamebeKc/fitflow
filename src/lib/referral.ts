// src/lib/referral.ts
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { getAdminDb } from "@/lib/firebase-admin";

/**
 * ── THE AFFILIATE LEDGER ────────────────────────────────────────────
 * Records one bounty when a referred user starts paying. Every row
 * this writes is a payment obligation, so the guarantees matter more
 * than the feature.
 *
 * IDEMPOTENCY IS THE DOCUMENT ID, NOT THE LOGIC. The event lives at
 * `referralEvents/{partnerSlug}__{uid}`. A replayed Flutterwave
 * webhook, a double-tapped verify route, a resubscribe after churn —
 * each tries to create a key that already exists and is refused by the
 * database. No amount of concurrency produces a second bounty, because
 * preventing it never depended on us checking.
 *
 * READS BEFORE WRITES. Firestore rejects any transaction that reads
 * after it writes. All four gets happen before the first create.
 *
 * FAILING IS FREE, PAYING TWICE IS NOT. Every rejection path returns a
 * reason rather than throwing, so a caller can log it and move on. The
 * one thing this must never do is record a bounty it isn't sure about.
 * ─────────────────────────────────────────────────────────────────────
 */

export type ReferralResult =
  | {
      recorded: true;
      partnerSlug: string;
      cohort: string | null;
      amount: number;
      currency: string;
    }
  | {
      recorded: false;
      reason:
        | "no_attribution"
        | "expired"
        | "inactive"
        | "capped"
        | "currency_mismatch"
        | "duplicate"
        | "error";
    };

/**
 * Call from the billing verify route, beside the existing
 * `trial_converted` event. Safe to call repeatedly.
 */
export async function recordReferralConversion(
  uid: string,
  txRef: string,
): Promise<ReferralResult> {
  const db = getAdminDb();

  try {
    return await db.runTransaction<ReferralResult>(async (tx) => {
      // ── Reads ─────────────────────────────────────────────────────
      const attribution = await tx.get(db.doc(`attributions/${uid}`));
      if (!attribution.exists) {
        return { recorded: false, reason: "no_attribution" };
      }

      const slug: string | null = attribution.get("referralCode") ?? null;
      if (!slug) return { recorded: false, reason: "no_attribution" };

      // The window is re-checked here rather than trusted from signup:
      // a partner's terms can change, and the browser record that
      // proposed it is not evidence.
      const expiresAt: Timestamp | null =
        attribution.get("attributionExpiresAt") ?? null;
      if (expiresAt && expiresAt.toMillis() < Date.now()) {
        return { recorded: false, reason: "expired" };
      }

      const partnerRef = db.doc(`partners/${slug}`);
      const partner = await tx.get(partnerRef);
      if (!partner.exists || partner.get("status") !== "active") {
        return { recorded: false, reason: "inactive" };
      }

      const eventRef = db.doc(`referralEvents/${slug}__${uid}`);
      const existing = await tx.get(eventRef);
      if (existing.exists) return { recorded: false, reason: "duplicate" };

      const amount: number = partner.get("terms.amount");
      const currency: string = partner.get("terms.currency");
      if (typeof amount !== "number" || !currency) {
        console.error("[referral] Partner has malformed terms:", slug);
        return { recorded: false, reason: "error" };
      }

      // A cap denominated in one currency cannot bound spend in
      // another. Better to record nothing and be asked about it than
      // to accrue ₦2,500 against a $100 ceiling.
      const capCurrency: string | null = partner.get("cap.currency") ?? null;
      if (capCurrency && capCurrency !== currency) {
        console.error("[referral] Cap/terms currency mismatch:", slug);
        return { recorded: false, reason: "currency_mismatch" };
      }

      const accrued: number = partner.get("counters.accruedAmount") ?? 0;
      const cap: number =
        partner.get("cap.totalAmount") ?? Number.MAX_SAFE_INTEGER;

      // The cap is the whole exposure control. Checked inside the
      // transaction so two simultaneous conversions can't both squeeze
      // past the ceiling.
      if (accrued + amount > cap) return { recorded: false, reason: "capped" };

      const cohort: string | null = attribution.get("cohort") ?? null;

      // ── Writes ────────────────────────────────────────────────────
      tx.create(eventRef, {
        partnerSlug: slug,
        cohort,
        uid,
        txRef,
        amount,
        currency,
        convertedAt: Timestamp.now(),
        payoutId: null,
        status: "accrued",
      });

      tx.update(partnerRef, {
        "counters.conversions": FieldValue.increment(1),
        "counters.accruedAmount": FieldValue.increment(amount),
      });

      return { recorded: true, partnerSlug: slug, cohort, amount, currency };
    });
  } catch (error) {
    // A ledger failure must not fail the payment it accompanies. The
    // customer has paid; sorting out a missing bounty is a support
    // task, whereas a 500 here would look like a failed transaction.
    console.error("[referral] Conversion record failed:", uid, error);
    return { recorded: false, reason: "error" };
  }
}
