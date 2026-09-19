// src/lib/billing-admin.ts
import { getAdminDb } from "@/lib/firebase-admin";
import {
  FOUNDING_LIMIT,
  PLANS,
  newBillingRecord,
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
 * Reads billing state, creating an empty record on first access.
 *
 * Under the hard paywall this record grants nothing — it exists so
 * there is somewhere for a subscription to be written. Reaching this
 * function at all means a request got past the client-side gate,
 * which is exactly why entitlement is re-derived server-side on every
 * gated request rather than trusted from the browser.
 */
export async function getOrCreateBilling(
  uid: string,
): Promise<BillingRecord> {
  const ref = billingRef(uid);
  const snapshot = await ref.get();

  if (snapshot.exists) {
    return snapshot.data() as BillingRecord;
  }

  const record = newBillingRecord();
  await ref.set(record);

  // No `trial_started` here any more. There is no trial to start, and
  // an event that fires on record creation would count people who
  // never saw a price. The funnel's first paid step is
  // `paywall_shown`, fired client-side where the paywall is actually
  // rendered.
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

/**
 * Advances the paid period after a successful charge.
 *
 * Returns `null` for lifetime, which has no period to advance —
 * callers write `lifetime: true` instead of a `currentPeriodEnd`, and
 * `isEntitled` reads that flag first.
 *
 * Driven off the plan's `interval` rather than a list of plan IDs. The
 * previous version tested `plan === "annual_ngn" || …`, which meant
 * every new plan ID silently defaulted to a one-month period — a
 * quarterly subscriber would have been charged for three months and
 * given one.
 */
export function periodEndFor(
  plan: PlanId,
  from: Date = new Date(),
): string | null {
  const interval = PLANS[plan]?.interval;
  const end = new Date(from);

  switch (interval) {
    case "lifetime":
      return null;
    case "weekly":
      end.setDate(end.getDate() + 7);
      break;
    case "quarterly":
      end.setMonth(end.getMonth() + 3);
      break;
    case "yearly":
      end.setFullYear(end.getFullYear() + 1);
      break;
    case "monthly":
      end.setMonth(end.getMonth() + 1);
      break;
    default:
      // An unknown plan ID reaching here means the catalogue and the
      // stored record have diverged. One month is the conservative
      // guess — it under-grants rather than over-grants, and the log
      // line is what gets it noticed.
      console.error("[billing] periodEndFor: unknown plan", plan);
      end.setMonth(end.getMonth() + 1);
  }

  return end.toISOString();
}

/* ── FOUNDING COHORT ──────────────────────────────────────────────
 * A single counter document, `config/founding`, holding how many
 * seats have been taken. Server-only: firestore.rules denies clients
 * every collection it does not name, and the paywall reads the count
 * through /api/founding instead.
 * ───────────────────────────────────────────────────────────────── */

const FOUNDING_DOC = "config/founding";

export interface FoundingStatus {
  claimed: number;
  limit: number;
  remaining: number;
}

export async function getFoundingStatus(): Promise<FoundingStatus> {
  const snapshot = await getAdminDb().doc(FOUNDING_DOC).get();
  const claimed = (snapshot.get("claimed") as number | undefined) ?? 0;
  return {
    claimed,
    limit: FOUNDING_LIMIT,
    remaining: Math.max(0, FOUNDING_LIMIT - claimed),
  };
}

/**
 * Marks an account as a founding member and advances the counter.
 *
 * IDEMPOTENT VIA THE BILLING RECORD, not via the counter. The flag on
 * `users/{uid}/billing/subscription` is read first inside the same
 * transaction that increments, so a replayed webhook, a double-tapped
 * verify, or both racing can only ever move the count by one per
 * account.
 *
 * THE SEAT IS GRANTED EVEN PAST THE LIMIT. By the time this runs the
 * customer has already been charged, and they were charged the
 * founding amount because that is what the Flutterwave payment plan
 * says. Refusing the flag here would record them as standard-priced
 * while billing them founding — a discrepancy in the ledger to avoid
 * a number going to 201. Closing the cohort is a pricing action
 * (swap BASE_PLANS to the standard plan IDs); it is not a race this
 * transaction should try to win.
 */
export async function claimFoundingSeat(uid: string): Promise<boolean> {
  const db = getAdminDb();
  const billing = billingRef(uid);
  const counter = db.doc(FOUNDING_DOC);

  try {
    return await db.runTransaction(async (tx) => {
      const existing = await tx.get(billing);
      if (existing.get("founding") === true) return false;

      const snapshot = await tx.get(counter);
      const claimed = (snapshot.get("claimed") as number | undefined) ?? 0;

      tx.set(
        counter,
        {
          claimed: claimed + 1,
          limit: FOUNDING_LIMIT,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
      tx.set(billing, { founding: true }, { merge: true });
      return true;
    });
  } catch (error) {
    // Never fail a payment over a counter. The customer is entitled
    // and correctly priced either way; a missed increment is a
    // reporting inaccuracy, not a billing one.
    console.error("[billing] Founding seat claim failed:", uid, error);
    return false;
  }
}
