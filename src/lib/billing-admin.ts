// src/lib/billing-admin.ts
import { getAdminDb } from "@/lib/firebase-admin";
import {
  newTrialRecord,
  type BillingRecord,
  type PlanId,
} from "@/lib/subscription";
import { trackServer } from "@/lib/analytics-server";

/**
 * Server-side billing state.
 *
 * Everything here uses the Admin SDK, which bypasses security rules —
 * so these functions must only ever be called from API routes that
 * have already verified the caller's ID token.
 *
 * Firestore security rules should make `users/{uid}/billing/**`
 * READ-ONLY to the client. If a user can write their own billing
 * document, they can grant themselves a subscription.
 */

function billingRef(uid: string) {
  return getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("billing")
    .doc("subscription");
}

/**
 * Reads billing state, creating a trial record on first access.
 *
 * The trial clock starts when someone first uses a gated feature, not
 * at signup — so a person who signs up and disappears for a month
 * still gets their full seven days when they come back.
 */
export async function getOrCreateBilling(
  uid: string,
): Promise<BillingRecord> {
  const ref = billingRef(uid);
  const snapshot = await ref.get();

  if (snapshot.exists) {
    return snapshot.data() as BillingRecord;
  }

  const record = newTrialRecord();
  await ref.set(record);

  // The trial genuinely starts HERE — no card, no checkout, just the
  // first gated request. The funnel document assumes card capture at
  // this step; this implementation has none, so the step measures
  // "began using the coach" rather than "committed a card".
  // Deliberately NOT awaited. This runs inside the entitlement check
  // on every chat request; a slow telemetry call here would delay the
  // coach, and the record above is already written either way.
  void trackServer(uid, "trial_started", {
    trial_days: 7,
    card_required: false,
  }).catch(() => {
    // Already logged inside trackServer.
  });

  return record;
}

/** Reads without creating. Returns null when absent. */
export async function getBilling(uid: string): Promise<BillingRecord | null> {
  const snapshot = await billingRef(uid).get();
  return snapshot.exists ? (snapshot.data() as BillingRecord) : null;
}

export async function updateBilling(
  uid: string,
  patch: Partial<BillingRecord>,
): Promise<void> {
  await billingRef(uid).set(
    { ...patch, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

/**
 * Finds the account a Flutterwave event belongs to.
 *
 * Webhooks arrive with an email, not a Firebase UID, so the link has
 * to be resolved. `billingEmail` is written at checkout precisely to
 * make this lookup possible — and it's a collection-group query
 * because billing documents live in per-user subcollections.
 */
export async function findUidByBillingEmail(
  email: string,
): Promise<string | null> {
  const matches = await getAdminDb()
    .collectionGroup("billing")
    .where("billingEmail", "==", email.toLowerCase())
    .limit(1)
    .get();

  if (matches.empty) return null;

  // Path is users/{uid}/billing/subscription — the uid is the parent
  // of the parent collection.
  const parent = matches.docs[0].ref.parent.parent;
  return parent ? parent.id : null;
}

/** Advances the paid period after a successful charge. */
export function periodEndFor(plan: PlanId, from: Date = new Date()): string {
  const end = new Date(from);
  if (plan === "annual_ngn" || plan === "annual_usd") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end.toISOString();
}