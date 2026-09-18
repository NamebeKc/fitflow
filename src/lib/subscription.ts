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
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export type PlanInterval =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "lifetime";

export type PlanId =
  | "weekly_ngn"
  | "monthly_ngn"
  | "quarterly_ngn"
  | "lifetime_ngn"
  | "weekly_usd"
  | "monthly_usd"
  | "quarterly_usd"
  | "lifetime_usd"
  // ── Retired, but NOT removable ───────────────────────────────────
  // Written into `users/{uid}/billing/subscription.plan` before the
  // September 2026 repricing. The renewal webhook rejects any plan
  // that isn't in PLANS (`planId in PLANS`), so deleting these would
  // stop renewing anyone who subscribed under the old catalogue.
  // They are excluded from the paywall by `retired`, not by absence.
  | "annual_ngn"
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
  interval: PlanInterval;
  display: string;
  /** Sub-line under the label, e.g. "Billed every 3 months". */
  cadence: string;
  /**
   * Normalised price per week, for the "₦1,223/week" line. Derived,
   * never typed by hand — see `WEEKS_PER_PERIOD`.
   */
  perWeek?: string;
  /**
   * DERIVED at module load from the amounts below, never hardcoded.
   * A saving badge is a price claim: if it says 50% it has to be at
   * least 50% off a price a customer could actually have paid, which
   * here is always the weekly plan in the same currency. Computing it
   * removes the only way for the badge and the arithmetic to disagree.
   */
  saving?: string;
  /** Marketing label — "Most popular", "Founding offer". */
  badge?: string;
  /** Excluded from the paywall; still honoured for existing records. */
  retired?: boolean;
}

/** How many billing periods fit in a 52-week year. */
const WEEKS_PER_PERIOD: Record<PlanInterval, number> = {
  weekly: 1,
  monthly: 52 / 12,
  quarterly: 13,
  yearly: 52,
  lifetime: Number.POSITIVE_INFINITY,
};

const BASE_PLANS: Record<PlanId, Omit<PlanDetails, "saving" | "perWeek">> = {
  /* ── Nigeria ──────────────────────────────────────────────────── */
  weekly_ngn: {
    id: "weekly_ngn",
    label: "Weekly",
    currency: "NGN",
    amount: 2500,
    interval: "weekly",
    display: "₦2,500",
    cadence: "Billed every week",
  },
  monthly_ngn: {
    id: "monthly_ngn",
    label: "Monthly",
    currency: "NGN",
    amount: 7900,
    interval: "monthly",
    display: "₦7,900",
    cadence: "Billed every month",
  },
  quarterly_ngn: {
    id: "quarterly_ngn",
    label: "3 months",
    currency: "NGN",
    amount: 15900,
    interval: "quarterly",
    display: "₦15,900",
    cadence: "Billed every 3 months",
    badge: "Most popular",
  },
  lifetime_ngn: {
    id: "lifetime_ngn",
    label: "Lifetime",
    currency: "NGN",
    amount: 149000,
    interval: "lifetime",
    display: "₦149,000",
    cadence: "One payment, never again",
    badge: "Founding offer",
  },

  /* ── International ────────────────────────────────────────────── */
  weekly_usd: {
    id: "weekly_usd",
    label: "Weekly",
    currency: "USD",
    amount: 2.49,
    interval: "weekly",
    display: "$2.49",
    cadence: "Billed every week",
  },
  monthly_usd: {
    id: "monthly_usd",
    label: "Monthly",
    currency: "USD",
    amount: 7.99,
    interval: "monthly",
    display: "$7.99",
    cadence: "Billed every month",
  },
  quarterly_usd: {
    id: "quarterly_usd",
    label: "3 months",
    currency: "USD",
    amount: 15.99,
    interval: "quarterly",
    display: "$15.99",
    cadence: "Billed every 3 months",
    badge: "Most popular",
  },
  lifetime_usd: {
    id: "lifetime_usd",
    label: "Lifetime",
    currency: "USD",
    amount: 149,
    interval: "lifetime",
    display: "$149",
    cadence: "One payment, never again",
    badge: "Founding offer",
  },

  /* ── Retired ──────────────────────────────────────────────────── */
  annual_ngn: {
    id: "annual_ngn",
    label: "Annual",
    currency: "NGN",
    amount: 37800,
    interval: "yearly",
    display: "₦37,800",
    cadence: "Billed every year",
    retired: true,
  },
  annual_usd: {
    id: "annual_usd",
    label: "Annual",
    currency: "USD",
    amount: 59.99,
    interval: "yearly",
    display: "$59.99",
    cadence: "Billed every year",
    retired: true,
  },
};

/** Price per week, in major units. Infinity-safe for lifetime. */
function perWeekAmount(plan: Omit<PlanDetails, "saving" | "perWeek">): number {
  return plan.amount / WEEKS_PER_PERIOD[plan.interval];
}

function formatMoney(currency: "NGN" | "USD", amount: number): string {
  return currency === "NGN"
    ? `₦${Math.round(amount).toLocaleString("en-NG")}`
    : `$${amount.toFixed(2)}`;
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
 *
 * ── WHY THE SAVING BADGES ARE COMPUTED ───────────────────────────
 * Every badge is measured against the WEEKLY plan in the same
 * currency, because that is the cheapest commitment a customer can
 * actually buy — so "Save 50%" means "half what you'd pay buying this
 * a week at a time", which is a true statement about two real prices.
 *
 * A badge measured against an invented list price is a fabricated
 * strike-through: prohibited under the FCCPA 2018 in Nigeria, the
 * FTC's pricing guidance in the US, and the CMA's in the UK — and it
 * is the first thing a customer's bank asks for in a chargeback
 * dispute. The percentages are floored, so a badge always understates
 * the real saving and can never overstate it.
 * ─────────────────────────────────────────────────────────────────────
 */
export const PLANS: Record<PlanId, PlanDetails> = Object.fromEntries(
  Object.entries(BASE_PLANS).map(([id, plan]) => {
    const anchor = plan.currency === "NGN" ? "weekly_ngn" : "weekly_usd";
    const anchorPerWeek = perWeekAmount(BASE_PLANS[anchor as PlanId]);
    const thisPerWeek = perWeekAmount(plan);

    const comparable =
      plan.interval !== "lifetime" && plan.interval !== "weekly";
    const percent = Math.floor((1 - thisPerWeek / anchorPerWeek) * 100);

    return [
      id,
      {
        ...plan,
        perWeek:
          plan.interval === "lifetime"
            ? undefined
            : `${formatMoney(plan.currency, thisPerWeek)}/week`,
        saving:
          comparable && percent > 0 && !plan.retired
            ? `Save ${percent}%`
            : undefined,
      },
    ];
  }),
) as Record<PlanId, PlanDetails>;

/**
 * Paywall order, cheapest commitment first, lifetime last.
 *
 * Retired plans are absent by construction rather than filtered at
 * every call site — a retired plan should be impossible to select,
 * not merely unlikely.
 */
export const PAYWALL_PLANS: Record<"NGN" | "USD", PlanId[]> = {
  NGN: ["weekly_ngn", "monthly_ngn", "quarterly_ngn", "lifetime_ngn"],
  USD: ["weekly_usd", "monthly_usd", "quarterly_usd", "lifetime_usd"],
};

/** The plan pre-selected when the paywall opens. */
export const DEFAULT_PLAN: Record<"NGN" | "USD", PlanId> = {
  NGN: "quarterly_ngn",
  USD: "quarterly_usd",
};

/** True for one-off purchases that never renew. */
export function isLifetimePlan(plan: PlanId | undefined): boolean {
  return plan ? PLANS[plan]?.interval === "lifetime" : false;
}

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