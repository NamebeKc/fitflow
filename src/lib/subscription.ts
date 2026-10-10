// src/lib/subscription.ts
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

import { PLANS as PLAN_CATALOGUE } from "@/lib/plan-catalogue";
import type { PlanId } from "@/lib/plan-catalogue";
import {
  GUARANTEE_DAYS as GUARANTEE_WINDOW,
  TRIAL_DAYS as TRIAL_WINDOW,
} from "@/lib/plan-catalogue";

/**
 * ── SUBSCRIPTIONS & ENTITLEMENT ─────────────────────────────────────
 * The trial is managed by AdimFit, not by Flutterwave.
 *
 * That's deliberate: a no-card trial means there is nothing to charge
 * until it ends, so there is no reason to involve the processor.
 * Flutterwave only enters the picture at the moment someone decides to
 * pay. Fewer moving parts, and more people through the funnel.
 *
 * ENTITLEMENT IS DECIDED SERVER-SIDE. This module's client half reads
 * billing state to render UI, but nothing in the browser is trusted:
 * the chat route re-derives entitlement from Firestore on every
 * request. A determined user editing local state gets a nicer-looking
 * paywall, not free access.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Length of the free trial, in days.
 *
 * The trial is CARD-FREE and managed here, not by Flutterwave.
 * Flutterwave payment plans have no trial parameter — the
 * subscription is created by the first charge — so a card-gated trial
 * would mean tokenising a card with a real non-zero charge and then
 * owning the entire dunning lifecycle the processor currently
 * handles. Managing the clock in Firestore costs one field.
 */
export { TRIAL_DAYS } from "@/lib/plan-catalogue";

/**
 * ── TRANSACTION REFERENCE PREFIXES ──────────────────────────────────
 * `tx_ref` is minted at checkout and re-checked at verification. It is
 * what proves a Flutterwave transaction belongs to the signed-in user,
 * and without that check one person's valid transaction ID could
 * activate someone else's account.
 *
 * These constants exist because the two ends disagreed. Checkout
 * minted `fitflow-{uid}-…` while verify demanded `adimfit-{uid}-…`, so
 * EVERY first payment was collected by Flutterwave and then rejected
 * by us with a 403 — money taken, no subscription, and a return page
 * saying we couldn't confirm the payment. The check was right; only
 * the literal was wrong, which is exactly the class of bug a shared
 * constant makes impossible to reintroduce.
 *
 * LEGACY_TX_REF_PREFIXES must not be emptied. Every reference minted
 * before this fix carries `fitflow-`, and those strings are permanent
 * — they live in Flutterwave's records, in `referralEvents.txRef`, and
 * in any charge a customer may still need re-verified. Dropping the
 * old prefix would re-break the payments this fix exists to recover.
 * ─────────────────────────────────────────────────────────────────────
 */
export const TX_REF_PREFIX = "adimfit";
export const LEGACY_TX_REF_PREFIXES = ["fitflow"] as const;

/** The reference minted for a new checkout attempt. */
export function mintTxRef(uid: string): string {
  return `${TX_REF_PREFIX}-${uid}-${Date.now()}`;
}

/** True when `ref` was minted for this uid, under any known prefix. */
export function txRefBelongsTo(ref: string, uid: string): boolean {
  if (!ref || !uid) return false;
  return [TX_REF_PREFIX, ...LEGACY_TX_REF_PREFIXES].some((prefix) =>
    ref.startsWith(`${prefix}-${uid}-`),
  );
}

export type SubscriptionStatus =
  /**
   * Signed up, no trial started, never paid. Written only during the
   * brief hard-paywall period of 19-20 September 2026; nothing mints
   * it now. `getOrCreateBilling` heals these into real trials on
   * next read, so the handful of accounts created that day are not
   * left permanently locked out.
   */
  | "none"
  /** Inside the card-free trial. `trialEndsAt` says until when. */
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

/**
 * ── THE PLAN CATALOGUE LIVES ELSEWHERE ──────────────────────────────
 * Plan IDs, prices and the founding-discount arithmetic now live in
 * `@/lib/plan-catalogue`, which imports nothing at all. This module
 * imports the Firebase client SDK, and a server component that only
 * wants to print "$49.99" should not have to drag an auth client into
 * the server bundle to get it.
 *
 * Everything is re-exported here unchanged, so every existing import
 * site keeps working. `@/lib/subscription` remains the address for
 * entitlement; `@/lib/plan-catalogue` is the address for price.
 * ─────────────────────────────────────────────────────────────────────
 */
export type { PlanInterval, PlanId, PlanDetails } from "@/lib/plan-catalogue";
export {
  PLANS,
  PAYWALL_PLANS,
  DEFAULT_PLAN,
  FOUNDING_LIMIT,
} from "@/lib/plan-catalogue";

export interface BillingRecord {
  status: SubscriptionStatus;
  /**
   * ISO timestamp — when the free trial runs out.
   *
   * Optional because records created under the hard paywall have no
   * trial to end. Only ever present on legacy `trialing` records.
   */
  trialEndsAt?: string;
  /** ISO timestamp — paid access valid until this point. */
  currentPeriodEnd?: string;
  /**
   * ISO timestamp of the most recent successful charge.
   *
   * Distinct from `updatedAt`, which moves on every write including
   * ones that took no money. The refund guarantee is measured from
   * this and nothing else, so it has to mean exactly one thing.
   */
  lastPaymentAt?: string;
  plan?: PlanId;
  /**
   * Flutterwave's subscription ID.
   *
   * Backfilled by `api/billing/cancel` the first time a cancellation
   * succeeds. Nothing writes it at checkout — the id only exists once
   * Flutterwave has created the subscription from the first charge,
   * and the charge response does not carry it — so the cancel route
   * finds it by billing email and records it on the way past.
   */
  flwSubscriptionId?: number;
  /** ISO timestamp of a confirmed cancellation. */
  cancelledAt?: string;
  /** Reason id from the cancellation page. Optional by design. */
  cancelReason?: string;
  /** Free text from the cancellation page. */
  cancelNote?: string;
  /**
   * Whether an active subscription actually existed at Flutterwave
   * when this account cancelled.
   *
   * False is legitimate — a one-off charge, or a mandate that had
   * already lapsed — and it is recorded rather than inferred so that
   * support can later tell "nothing to cancel" apart from "we never
   * found it".
   */
  providerSubscriptionFound?: boolean;
  /**
   * Set once a lifetime plan is paid for, and never unset.
   *
   * An EXPLICIT flag, not an inference from a missing
   * `currentPeriodEnd`. Absence of a field is also what a half-written
   * record, a failed migration or a future refactor looks like, and
   * the failure mode there is granting permanent free access to
   * someone who never bought it. A flag has to be written on purpose.
   */
  lifetime?: boolean;
  /** Subscriptions are bound to this email and cannot be reassigned. */
  billingEmail?: string;
  /**
   * Set once this account has taken a founding-cohort seat. Written
   * only by `claimFoundingSeat`, never unset — the price is locked by
   * the Flutterwave payment plan regardless, so this is a record of
   * what happened rather than the thing that grants it.
   */
  founding?: boolean;
  /**
   * ISO timestamp. Complimentary access granted outside of billing —
   * pilot users, testers, support gestures. Set only by the admin
   * script; never writable from the browser.
   */
  compedUntil?: string;
  /** Why access was granted. Kept so the reason survives the grant. */
  compedReason?: string;
  updatedAt: string;
}


/**
 * ── THE REFUND GUARANTEE ────────────────────────────────────────────
 * Seven days from any charge, refunded on request, no reason needed.
 *
 * THIS IS WHY THERE IS NO FREE TRIAL. Flutterwave payment plans have
 * no trial primitive — the subscription is created BY the first
 * charge — so a card-gated trial would mean tokenising a card with a
 * real non-zero charge, running our own scheduler, and owning the
 * entire dunning lifecycle that Flutterwave currently handles. The
 * guarantee buys the same thing the trial was for, which is removing
 * the fear of being stuck, and costs a support inbox instead of a
 * subscription engine.
 *
 * IT APPLIES TO EVERY CHARGE, NOT JUST THE FIRST. More generous than
 * the usual first-purchase-only version, and deliberately so: the
 * renewal nobody wanted is precisely the charge that becomes a
 * chargeback, and a chargeback costs the fee plus a mark against the
 * merchant account. A refund is the cheaper version of the same
 * outcome.
 *
 * A PROMISE MADE ON THE PAYWALL IS A PROMISE. This constant is read
 * by the paywall, the post-purchase screen, the subscription card and
 * the terms page, so all four cannot drift apart and quietly start
 * offering different windows.
 * ─────────────────────────────────────────────────────────────────────
 */
export { GUARANTEE_DAYS } from "@/lib/plan-catalogue";

/** When the current refund window closes, or null if none is open. */
export function guaranteeEndsAt(
  billing: Pick<BillingRecord, "lastPaymentAt"> | null | undefined,
): string | null {
  if (!billing?.lastPaymentAt) return null;
  const paid = new Date(billing.lastPaymentAt);
  if (Number.isNaN(paid.getTime())) return null;
  return new Date(
    paid.getTime() + GUARANTEE_WINDOW * 86_400_000,
  ).toISOString();
}

/** True while the most recent charge is still refundable on request. */
export function withinGuarantee(
  billing: Pick<BillingRecord, "lastPaymentAt"> | null | undefined,
  now: Date = new Date(),
): boolean {
  const ends = guaranteeEndsAt(billing);
  return ends !== null && new Date(ends) > now;
}


export type Currency = "NGN" | "USD";

/**
 * ── WHICH CURRENCIES CAN ACTUALLY BE COLLECTED ──────────────────────
 * Not a pricing decision — a payment-processor one. A Nigerian
 * Flutterwave merchant needs separate approval for international card
 * collection, and until that lands a USD checkout fails at the
 * processor with an error the customer reads as a declined card.
 *
 * Showing a price you cannot charge is worse than showing no price at
 * all: the customer picks a plan, commits, taps pay, and is told
 * something went wrong. The dollar prices stay in the catalogue so
 * nothing has to be re-derived later — they are simply not offered.
 *
 * DELIBERATELY A CONSTANT, NOT AN ENV VAR. The paywall is a client
 * component, so an env-driven version would have to be NEXT_PUBLIC_*
 * — inlined at build time, absent at runtime, and already the cause
 * of three separate silent failures in this codebase (runbook §1).
 * Flipping this requires a deploy either way, and a constant cannot
 * be half-configured.
 *
 * Both are enabled: the six Flutterwave payment plans exist and are
 * active on merchant 100838261. Note that creating a USD payment plan
 * is NOT the same as being approved to charge international cards —
 * if USD checkouts start failing at the processor, drop "USD" from
 * this list and deploy. That is the whole point of the switch: the
 * dollar prices stay in the catalogue, they are simply not offered.
 */
export const ENABLED_CURRENCIES: readonly Currency[] = ["NGN", "USD"];

/** The currency the paywall opens on. */
export const PRIMARY_CURRENCY: Currency = ENABLED_CURRENCIES[0] ?? "NGN";

export function isCurrencyEnabled(currency: Currency): boolean {
  return ENABLED_CURRENCIES.includes(currency);
}

/** True for one-off purchases that never renew. */
export function isLifetimePlan(plan: PlanId | undefined): boolean {
  return plan ? PLAN_CATALOGUE[plan]?.interval === "lifetime" : false;
}

/**
 * A fresh trial record.
 *
 * The clock starts HERE — on the first read of a billing document,
 * which happens when someone first opens the app after onboarding —
 * rather than at signup. Someone who registers and disappears for a
 * month still gets their full seven days when they come back, which
 * is the version that treats a slow start as a life event rather
 * than a forfeit.
 */
export function newTrialRecord(): BillingRecord {
  const now = new Date();
  return {
    status: "trialing",
    trialEndsAt: new Date(
      now.getTime() + TRIAL_WINDOW * 86_400_000,
    ).toISOString(),
    updatedAt: now.toISOString(),
  };
}

/**
 * The single source of truth for "may this person use the coach".
 *
 * Shared by client and server so both agree on the rule — but only the
 * server's verdict actually gates anything.
 */
export function isEntitled(
  billing: BillingRecord | null,
  now: Date = new Date(),
): boolean {
  if (!billing) return false;

  // Complimentary access outranks everything, including an expired
  // trial or a lapsed subscription. Pilot users should never see a
  // paywall because a webhook misfired.
  if (billing.compedUntil && new Date(billing.compedUntil) > now) {
    return true;
  }

  // Lifetime is checked before status, because there is no renewal to
  // succeed or fail: a lifetime buyer must not be locked out by a
  // `past_due` left behind from an earlier subscription, or by a
  // webhook that arrives for a plan they no longer hold.
  if (billing.lifetime) return true;

  if (billing.status === "active") {
    // A cancelled-but-paid subscription keeps access to period end;
    // people who cancel have still paid for the time they bought.
    if (!billing.currentPeriodEnd) return true;
    return new Date(billing.currentPeriodEnd) > now;
  }

  if (billing.status === "cancelled" && billing.currentPeriodEnd) {
    return new Date(billing.currentPeriodEnd) > now;
  }

  // A record without `trialEndsAt` cannot be entitled by this branch.
  // A half-written or partially migrated document fails closed rather
  // than granting an unbounded trial.
  if (billing.status === "trialing" && billing.trialEndsAt) {
    return new Date(billing.trialEndsAt) > now;
  }

  // past_due keeps access briefly so a failed card doesn't lock out a
  // paying customer mid-week while retries run.
  if (billing.status === "past_due" && billing.currentPeriodEnd) {
    const grace = new Date(
      new Date(billing.currentPeriodEnd).getTime() + 3 * 86_400_000,
    );
    return grace > now;
  }

  return false;
}

/** True when access comes from a grant rather than a payment. */
export function isComped(
  billing: BillingRecord | null,
  now: Date = new Date(),
): boolean {
  return Boolean(
    billing?.compedUntil && new Date(billing.compedUntil) > now,
  );
}

/** Whole days of trial remaining; 0 once expired. */
export function trialDaysLeft(
  billing: BillingRecord | null,
  now: Date = new Date(),
): number {
  if (!billing || billing.status !== "trialing" || !billing.trialEndsAt) {
    return 0;
  }
  const ms = new Date(billing.trialEndsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/* ══ Client-side read ═════════════════════════════════════════════ */

export async function loadBilling(uid: string): Promise<BillingRecord | null> {
  try {
    const snapshot = await getDoc(doc(db, "users", uid, "billing", "subscription"));
    return snapshot.exists() ? (snapshot.data() as BillingRecord) : null;
  } catch (error) {
    console.error("[billing] Failed to load:", error);
    return null;
  }
}
