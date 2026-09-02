// src/lib/subscription.ts
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";

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

export const TRIAL_DAYS = 7;

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export type PlanId =
  | "monthly_ngn"
  | "annual_ngn"
  | "monthly_usd"
  | "annual_usd";

export interface BillingRecord {
  status: SubscriptionStatus;
  /** ISO timestamp — when the free trial runs out. */
  trialEndsAt: string;
  /** ISO timestamp — paid access valid until this point. */
  currentPeriodEnd?: string;
  plan?: PlanId;
  /** Flutterwave's subscription ID, needed to cancel. */
  flwSubscriptionId?: number;
  /** Subscriptions are bound to this email and cannot be reassigned. */
  billingEmail?: string;
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

export interface PlanDetails {
  id: PlanId;
  label: string;
  currency: "NGN" | "USD";
  /** Major units — naira or dollars, not kobo or cents. */
  amount: number;
  interval: "monthly" | "yearly";
  display: string;
  /** Shown against the monthly equivalent on annual plans. */
  saving?: string;
}

/**
 * THESE AMOUNTS MUST MATCH THE FLUTTERWAVE PAYMENT PLANS EXACTLY.
 *
 * The plan on Flutterwave's side determines what the customer is
 * actually charged; this catalogue determines what they are SHOWN and
 * what the verify route accepts. A mismatch means displaying one price
 * and taking another — which is both a trust problem and, depending on
 * jurisdiction, a legal one.
 *
 * Change a price in the Flutterwave dashboard and you must change it
 * here in the same commit.
 */
export const PLANS: Record<PlanId, PlanDetails> = {
  monthly_usd: {
    id: "monthly_usd",
    label: "Monthly",
    currency: "USD",
    amount: 7.99,
    interval: "monthly",
    display: "$7.99",
  },
  annual_usd: {
    id: "annual_usd",
    label: "Annual",
    currency: "USD",
    amount: 59.99,
    interval: "yearly",
    display: "$59.99",
    saving: "Save 37%",
  },
  monthly_ngn: {
    id: "monthly_ngn",
    label: "Monthly",
    currency: "NGN",
    amount: 4500,
    interval: "monthly",
    display: "₦4,500",
  },
  annual_ngn: {
    id: "annual_ngn",
    label: "Annual",
    currency: "NGN",
    amount: 37800,
    interval: "yearly",
    display: "₦37,800",
    saving: "Save 30%",
  },
};

/** A fresh trial record, created the first time billing is read. */
export function newTrialRecord(): BillingRecord {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 86_400_000);
  return {
    status: "trialing",
    trialEndsAt: trialEnd.toISOString(),
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

  if (billing.status === "active") {
    // A cancelled-but-paid subscription keeps access to period end;
    // people who cancel have still paid for the time they bought.
    if (!billing.currentPeriodEnd) return true;
    return new Date(billing.currentPeriodEnd) > now;
  }

  if (billing.status === "cancelled" && billing.currentPeriodEnd) {
    return new Date(billing.currentPeriodEnd) > now;
  }

  if (billing.status === "trialing") {
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
  if (!billing || billing.status !== "trialing") return 0;
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