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

export type PlanInterval =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "lifetime";

export type PlanId =
  | "weekly_ngn"
  | "monthly_ngn"
  | "annual_ngn_2026"
  | "lifetime_ngn"
  | "weekly_usd"
  | "monthly_usd"
  | "annual_usd_2026"
  | "lifetime_usd"
  // ── Retired, but NOT removable ───────────────────────────────────
  // Written into `users/{uid}/billing/subscription.plan` before the
  // September 2026 repricing. The renewal webhook rejects any plan
  // that isn't in PLANS (`planId in PLANS`), so deleting these would
  // stop renewing anyone who subscribed under the old catalogue.
  // They are excluded from the paywall by `retired`, not by absence.
  //
  // WHY THE LIVE ANNUAL PLAN IS `annual_ngn_2026` AND NOT `annual_ngn`.
  // A plan ID is a stored contract: `annual_ngn` is written into the
  // billing document of everyone who bought the ₦37,800 plan, and it
  // is what the subscription card reads to show them their price.
  // Repointing that ID at ₦49,900 would quote the new price to
  // customers who are paying the old one. The year suffix means the
  // next reprice is `annual_ngn_2027` and nothing already sold moves.
  | "annual_ngn"
  | "annual_usd";

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
   * The struck-through standard price, e.g. "₦5,000". Present only
   * while the plan is being sold at founding-cohort pricing.
   */
  standardDisplay?: string;
  /**
   * DERIVED at module load from `STANDARD_PRICING`, never hardcoded.
   *
   * A saving badge is a price claim, so it is measured against the
   * standard price this plan reverts to once the founding cohort is
   * full — a price this product will actually charge, not an invented
   * anchor. Computing it removes the only way for the badge and the
   * arithmetic to disagree, and it is floored, so a badge can only
   * ever understate the real discount.
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
  annual_ngn_2026: {
    id: "annual_ngn_2026",
    label: "Yearly",
    currency: "NGN",
    amount: 49900,
    interval: "yearly",
    display: "₦49,900",
    cadence: "Billed once a year",
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
  annual_usd_2026: {
    id: "annual_usd_2026",
    label: "Yearly",
    currency: "USD",
    amount: 49.99,
    interval: "yearly",
    display: "$49.99",
    cadence: "Billed once a year",
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

/**
 * ── FOUNDING COHORT PRICING ─────────────────────────────────────────
 * The prices in BASE_PLANS are HALF these. That is what makes "50%
 * off" a true statement on every row rather than a decoration: these
 * are the standard prices, and they go live for everyone who joins
 * after the founding cohort fills.
 *
 * THE PROMISE THIS MAKES. "50% off for life" is not a marketing line
 * the app has to remember to honour — a Flutterwave payment plan
 * locks its amount at the moment of subscription, so a founding
 * member is charged the founding amount by the plan itself, for as
 * long as they stay subscribed. There is no per-user price logic to
 * get wrong.
 *
 * WHAT HAPPENS WHEN THE COHORT FILLS. Six new Flutterwave payment
 * plans are created at these amounts, their IDs go in the env, and
 * BASE_PLANS moves to them. Existing members are untouched, because
 * their subscription is bound to the old plan. Until that day these
 * standard prices exist only as the struck-through number.
 *
 * Every entry must be at least double its BASE_PLANS amount, or the
 * badge would overstate. `assertFoundingDiscount()` below enforces it
 * at module load rather than trusting the table.
 * ─────────────────────────────────────────────────────────────────────
 */
const STANDARD_PRICING: Partial<
  Record<PlanId, { amount: number; display: string }>
> = {
  weekly_ngn: { amount: 5000, display: "₦5,000" },
  monthly_ngn: { amount: 15900, display: "₦15,900" },
  annual_ngn_2026: { amount: 99900, display: "₦99,900" },
  lifetime_ngn: { amount: 299000, display: "₦299,000" },
  weekly_usd: { amount: 4.99, display: "$4.99" },
  monthly_usd: { amount: 15.99, display: "$15.99" },
  annual_usd_2026: { amount: 99.99, display: "$99.99" },
  lifetime_usd: { amount: 299, display: "$299" },
};

/** How many seats are sold at founding pricing. */
export const FOUNDING_LIMIT = 200;

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
export const GUARANTEE_DAYS = 7;

/** When the current refund window closes, or null if none is open. */
export function guaranteeEndsAt(
  billing: Pick<BillingRecord, "lastPaymentAt"> | null | undefined,
): string | null {
  if (!billing?.lastPaymentAt) return null;
  const paid = new Date(billing.lastPaymentAt);
  if (Number.isNaN(paid.getTime())) return null;
  return new Date(
    paid.getTime() + GUARANTEE_DAYS * 86_400_000,
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
    const standard = plan.retired
      ? undefined
      : STANDARD_PRICING[id as PlanId];

    const percent = standard
      ? Math.floor((1 - plan.amount / standard.amount) * 100)
      : 0;

    const thisPerWeek = perWeekAmount(plan);

    return [
      id,
      {
        ...plan,
        perWeek:
          plan.interval === "lifetime"
            ? undefined
            : `${formatMoney(plan.currency, thisPerWeek)}/week`,
        standardDisplay: standard?.display,
        saving: standard && percent > 0 ? `Save ${percent}%` : undefined,
      },
    ];
  }),
) as Record<PlanId, PlanDetails>;

/**
 * Fails the build rather than shipping an overstated badge.
 *
 * A saving badge is a price claim. If a standard price were ever
 * edited to less than double its founding price, every paywall would
 * quietly start advertising a discount larger than the one on offer —
 * the exact failure this whole module is arranged to prevent. Better
 * to refuse to start.
 */
function assertFoundingDiscount(): void {
  for (const [id, standard] of Object.entries(STANDARD_PRICING)) {
    const plan = BASE_PLANS[id as PlanId];
    if (!plan || !standard) continue;
    const real = (1 - plan.amount / standard.amount) * 100;
    if (real < 50) {
      throw new Error(
        `[pricing] ${id} claims 50% off but the real discount is ` +
          `${real.toFixed(1)}% (${plan.amount} vs standard ` +
          `${standard.amount}). Fix STANDARD_PRICING.`,
      );
    }
  }
}

assertFoundingDiscount();

/**
 * Paywall order, cheapest commitment first, lifetime last.
 *
 * Retired plans are absent by construction rather than filtered at
 * every call site — a retired plan should be impossible to select,
 * not merely unlikely.
 *
 * The weekly plan stays on this list even though almost nobody should
 * pick it. It is the price every saving badge is measured against, and
 * a discount measured against something a customer cannot actually buy
 * is a fabricated anchor. Weekly has to remain purchasable for "Save
 * 61%" to stay a true statement about two real prices.
 */
export const PAYWALL_PLANS: Record<"NGN" | "USD", PlanId[]> = {
  NGN: ["weekly_ngn", "monthly_ngn", "annual_ngn_2026", "lifetime_ngn"],
  USD: ["weekly_usd", "monthly_usd", "annual_usd_2026", "lifetime_usd"],
};

/** The plan pre-selected when the paywall opens. */
export const DEFAULT_PLAN: Record<"NGN" | "USD", PlanId> = {
  NGN: "annual_ngn_2026",
  USD: "annual_usd_2026",
};

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
  return plan ? PLANS[plan]?.interval === "lifetime" : false;
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
      now.getTime() + TRIAL_DAYS * 86_400_000,
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