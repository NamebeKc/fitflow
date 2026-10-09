// src/lib/plan-catalogue.ts

/**
 * ── WHAT THINGS COST ────────────────────────────────────────────────
 * Extracted from `subscription.ts` so this file imports NOTHING.
 *
 * The reason is the public landing page. It is a server component
 * that has to print real prices into the HTML — both for readers and
 * for the retrieval bots that never run JavaScript — and it must not
 * pull the Firebase auth client into the server bundle to do it.
 *
 * It is also the fix for a defect this extraction exposed: the
 * landing page had been advertising $59.99/year at "save 37%" while
 * `annual_usd` was already `retired: true`. The plan actually on sale
 * is `annual_usd_2026` at $49.99, half its standard price. A price
 * printed by hand in a second place is a price that goes stale
 * silently; every figure the marketing page shows is now read from
 * this table.
 *
 * `subscription.ts` re-exports all of this, so existing import sites
 * are unaffected.
 * ─────────────────────────────────────────────────────────────────────
 */
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

/**
 * ── POLICY WINDOWS ──────────────────────────────────────────────────
 * Here rather than in `subscription.ts` for the same reason as the
 * prices: the public FAQ states both numbers, in server-rendered HTML
 * and in the FAQPage schema an assistant may quote back. A promise
 * printed on a public page and a promise enforced in code must come
 * from the same constant, or they drift and the page becomes a
 * commitment nobody is keeping.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Length of the card-free free trial, in days. */
export const TRIAL_DAYS = 7;

/** Days from any charge within which a refund is given on request. */
export const GUARANTEE_DAYS = 7;
