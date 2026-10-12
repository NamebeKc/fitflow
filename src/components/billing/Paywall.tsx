// src/components/billing/Paywall.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { track } from "@/lib/analytics";
import {
  DEFAULT_PLAN,
  ENABLED_CURRENCIES,
  FOUNDING_LIMIT,
  GUARANTEE_DAYS,
  PAYWALL_PLANS,
  PLANS,
  PRIMARY_CURRENCY,
  type Currency,
  type PlanId,
  type PlanInterval,
} from "@/lib/subscription";

/**
 * How each interval is described in the "then X every Y" line.
 *
 * Exhaustive over PlanInterval, so adding an interval to the catalogue
 * is a type error here rather than a sentence that silently says
 * "every month" about a yearly plan — which is what the previous
 * ternary chain did to every interval it didn't name.
 */
const RECURS: Record<PlanInterval, string> = {
  weekly: "every week",
  monthly: "every month",
  quarterly: "every 3 months",
  yearly: "every year",
  lifetime: "never",
};

interface PaywallProps {
  /** Shown above the plans — why they're seeing this. */
  headline?: string;
  subline?: string;
}

/** What detection believes about where this visitor is. */
type Region = "unknown" | "ng" | "intl";

/**
 * The subscribe screen.
 *
 * Currency is CHOSEN, not detected. IP geolocation guesses wrong for
 * anyone travelling or on a VPN, and being quietly charged in the
 * wrong currency is a worse first impression than one extra tap.
 *
 * The 3-month plan is pre-selected because it's the one that actually
 * retains — weekly and monthly churn hard in fitness — but every plan
 * sits in the same single column at the same visual weight, with its
 * real price and its real per-week cost. Pre-selecting is a nudge;
 * hiding the alternative would be a trick.
 *
 * The saving badges come from `PLANS`, where they are computed from
 * the amounts rather than written by hand. Nothing in this file should
 * ever contain a percentage literal.
 */
export function Paywall({
  headline = "Start training with your coach",
  subline = "One subscription unlocks the coach, your plans, and every session you log.",
}: PaywallProps) {
  const { user } = useAuth();
  const [currency, setCurrency] = useState<Currency>(PRIMARY_CURRENCY);
  /**
   * Where we think they are. Drives which price leads AND whether
   * the other one is advertised at all.
   */
  const [region, setRegion] = useState<Region>("unknown");
  const [selected, setSelected] = useState<PlanId>(
    DEFAULT_PLAN[PRIMARY_CURRENCY],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once the user picks a currency themselves — after that,
  // detection must never override their choice.
  const [userChose, setUserChose] = useState(false);
  // null until known, and stays null if the count can't be read.
  const [seatsLeft, setSeatsLeft] = useState<number | null>(null);

  /**
   * Founding seats remaining.
   *
   * Scarcity has to be real to be worth showing. This is a live count
   * of subscriptions taken, not a countdown that resets on reload —
   * and if the endpoint fails it stays null and the line simply does
   * not render, rather than falling back to a flattering guess.
   */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/founding")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { remaining?: number | null } | null) => {
        if (cancelled) return;
        if (typeof data?.remaining === "number") setSeatsLeft(data.remaining);
      })
      .catch(() => {
        // Marketing copy, not a blocker.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Region detection, in two passes.
   *
   * THE OLD VERSION ONLY EVER SWITCHED TO NAIRA. It opened on
   * PRIMARY_CURRENCY (NGN), checked for `Africa/Lagos`, and checked a
   * geo header that returned `currency: null` for every country that
   * was not Nigeria. So a visitor in London matched nothing, nothing
   * changed, and they were shown Naira prices — which is the exact
   * opposite of what the detection was for.
   *
   * It is now three-way: Nigeria, international, or unknown.
   *
   * The TIMEZONE runs first because it is instant, needs no network,
   * and survives a VPN that does not also change the system clock.
   * The server header follows and wins when present — it reflects the
   * real connection rather than a device setting. On plain Cloud Run
   * it returns nothing (see api/geo), so in practice the timezone
   * does the work today.
   *
   * KNOWN FALSE POSITIVE: eleven West and Central African zones share
   * WAT with Lagos, and modern tzdb links several of them to
   * `Africa/Lagos` outright — Porto-Novo, Niamey, Douala and the
   * rest. Someone in Benin or Cameroon can therefore read as
   * Nigerian and be shown Naira, which their card will not settle.
   * That error is recoverable in one tap, which is why the escape
   * hatch below is never removed entirely.
   */
  useEffect(() => {
    // Nothing to detect when only one currency can be collected.
    if (ENABLED_CURRENCIES.length < 2) return;

    let cancelled = false;

    function apply(next: Currency, detected: Region) {
      if (cancelled) return;
      setRegion(detected);
      if (userChose) return;
      setCurrency(next);
      setSelected(DEFAULT_PLAN[next]);
    }

    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
      if (zone === "Africa/Lagos") {
        apply("NGN", "ng");
      } else if (zone) {
        // A valid zone that is not Lagos is positive evidence of
        // somewhere else — weaker than an IP, strong enough to pick
        // which price to show first.
        apply("USD", "intl");
      }
    } catch {
      // Older browsers may not expose the zone — stay on the default.
    }

    fetch("/api/geo")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { currency?: string | null } | null) => {
        if (data?.currency === "NGN") apply("NGN", "ng");
        else if (data?.currency === "USD") apply("USD", "intl");
      })
      .catch(() => {
        // Detection is a convenience — its failure changes nothing.
      });

    return () => {
      cancelled = true;
    };
  }, [userChose]);

  /**
   * Swapping currency keeps the INTERVAL the customer chose, rather
   * than resetting to the default. Someone who deliberately picked
   * weekly and then corrected the currency still wants weekly; sending
   * them back to the 3-month plan would quietly change what they are
   * about to buy.
   */
  function switchCurrency(next: Currency) {
    setUserChose(true);
    setCurrency(next);

    const interval = PLANS[selected].interval;
    const match = PAYWALL_PLANS[next].find(
      (id) => PLANS[id].interval === interval,
    );
    setSelected(match ?? DEFAULT_PLAN[next]);
  }

  const visiblePlans = PAYWALL_PLANS[currency].map((id) => PLANS[id]);

  async function checkout() {
    if (!user || busy) return;
    setBusy(true);
    setError(null);

    try {
      track("checkout_started", {
        plan: selected,
        currency,
        provider: "flutterwave",
      });
      const idToken = await user.getIdToken();

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ plan: selected }),
      });

      const data = await response.json();

      if (!response.ok || !data.link) {
        setError(data.error ?? "Couldn't start checkout. Please try again.");
        setBusy(false);
        return;
      }

      // Hand off to Flutterwave's hosted page — card details never
      // touch our origin, which keeps PCI scope where it belongs.
      window.location.href = data.link;
    } catch (checkoutError) {
      console.error("[paywall] Checkout failed:", checkoutError);
      setError("Couldn't reach the payment page. Please try again.");
      setBusy(false);
    }
  }

  const selectedPlan = PLANS[selected];

  const included = [
    "Unlimited coaching conversations",
    "Adaptive plans built from your history",
    "Full training log, synced everywhere",
    "Progress tracking and milestones",
  ];

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="rounded-lg border border-rule bg-paper-raised p-6 sm:p-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-moss">
          Subscribe
        </p>
        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-ink">
          {headline}
        </h2>
        <p className="mt-2.5 text-[15px] leading-relaxed text-ink-muted">
          {subline}
        </p>

        {/*
          VALUE BEFORE PRICE. This list used to sit below the CTA,
          where a reader had already decided against the price before
          reaching it. Everything the money buys is now established
          before a single number appears on screen.
        */}
        <ul className="mt-6 space-y-2">
          {included.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Check
                className="mt-0.5 size-3.5 shrink-0 text-moss"
                strokeWidth={3}
              />
              <span className="text-[14px] leading-relaxed text-ink-muted">
                {item}
              </span>
            </li>
          ))}
        </ul>

        {/*
          The scarcity line sits directly above the prices, because
          that is where the struck-through number needs explaining:
          it is not a permanent discount, it is a cohort that closes.
        */}
        {seatsLeft !== null && seatsLeft > 0 && (
          <p className="mt-6 rounded-md border border-moss/25 bg-lime-wash px-3.5 py-2.5 text-center text-[13px] leading-relaxed text-moss">
            Founding member pricing — {seatsLeft} of {FOUNDING_LIMIT} seats
            left
            <span className="mt-0.5 block text-[12px] text-ink-muted">
              Half price, locked for as long as you stay subscribed.
            </span>
          </p>
        )}

        {/*
          WHY THIS IS NOT ALWAYS A TOGGLE.
          
          The two price lists are not conversions of each other. The
          monthly plan is 7,900 naira or 7.99 dollars, and the naira
          price is the cheaper of the two at any exchange rate above
          about 989 to the dollar — which is to say, at every rate of
          the last several years. Shown side by side to someone
          abroad, the rational move is to pick naira, and a card
          issued outside Nigeria will then usually fail to settle it.
          So they would have chosen the cheaper price, been declined,
          and concluded the product is broken.

          A detected international visitor therefore sees dollars and
          a quiet text link, not a toggle with the naira price on it.
          The link stays because detection is a guess: a Nigerian on a
          VPN, or one of the WAT false positives above, must still be
          able to reach their own currency. Hiding it completely would
          save nothing and strand real customers.
        */}
        {ENABLED_CURRENCIES.length > 1 &&
          (region === "intl" && !userChose ? (
            <p className="mt-6 text-center text-[13px] text-ink-muted">
              Prices in US dollars.{" "}
              <button
                type="button"
                onClick={() => switchCurrency("NGN")}
                className="font-medium text-moss underline underline-offset-4 outline-none transition-colors hover:text-moss-deep focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised"
              >
                Paying from Nigeria?
              </button>
            </p>
          ) : (
            <div className="mt-6 flex rounded-sm bg-paper p-1">
              {ENABLED_CURRENCIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => switchCurrency(value)}
                  className={cn(
                    "flex-1 rounded-sm px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] outline-none transition-colors",
                    currency === value
                      ? "bg-lime text-on-lime"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  {value === "NGN" ? "₦ Naira" : "$ Dollars"}
                </button>
              ))}
            </div>
          ))}

        {/* Plans */}
        <div className="mt-4 space-y-2.5">
          {visiblePlans.map((plan) => {
            const active = selected === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelected(plan.id)}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-center gap-3.5 rounded-md border px-4 py-4 text-left outline-none transition-all active:translate-y-px",
                  "focus-visible:ring-2 focus-visible:ring-moss",
                  active
                    ? "border-moss bg-lime-wash"
                    : "border-rule bg-paper-sunken hover:border-rule",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    active
                      ? "border-moss bg-lime"
                      : "border-rule",
                  )}
                >
                  {active && (
                    <Check className="size-3 text-on-lime" strokeWidth={3.5} />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[15px] font-semibold text-ink">
                      {plan.label}
                    </span>
                    {plan.saving && (
                      <span className="rounded-full bg-lime-wash px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-moss">
                        {plan.saving}
                      </span>
                    )}
                    {plan.badge && (
                      <span className="rounded-full border border-rule px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-muted">
                        {plan.badge}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-ink-muted">
                    {plan.cadence}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  {plan.standardDisplay && (
                    <span className="block font-mono text-[11px] tabular-nums text-ink-faint line-through">
                      {plan.standardDisplay}
                    </span>
                  )}
                  <span className="block font-mono text-lg tabular-nums text-ink">
                    {plan.display}
                  </span>
                  {plan.perWeek && (
                    <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-ink-faint">
                      {plan.perWeek}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-200"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void checkout()}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-lime px-6 py-3.5 text-[15px] font-semibold text-on-lime outline-none transition-all hover:bg-lime-press focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:translate-y-px disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
          ) : (
            <>
              Continue to payment
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </>
          )}
        </button>

        {/*
          THE GUARANTEE SITS UNDER THE BUTTON, NOT IN THE TERMS.

          It is doing the job a free trial would do — removing the
          fear of being stuck — and it can only do that job if it is
          read before the decision rather than discovered after it.
          Flutterwave has no trial primitive, so this is the honest
          version of the same offer: the money moves, and it moves
          back on request.

          Both the window and the wording come from GUARANTEE_DAYS,
          which the terms page and the subscription card also read, so
          the promise cannot quietly differ by surface.
        */}
        <div className="mt-4 rounded-md border border-moss/25 bg-lime-wash px-3.5 py-3 text-center">
          <p className="text-[13px] font-medium leading-relaxed text-moss">
            {GUARANTEE_DAYS}-day money-back guarantee
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
            Not for you? Email us within {GUARANTEE_DAYS} days and we refund
            it in full. No reason needed, no forms.
          </p>
        </div>

        {/*
          The three things people actually hesitate over, answered
          where the hesitation happens rather than in a terms page:
          when it charges, how to stop it, and how to get the money
          back. A visible refund route costs less than a chargeback —
          the bank's version of the same request carries a fee and
          counts against the merchant account.
        */}
        <p className="mt-3.5 text-center text-[12px] leading-relaxed text-ink-muted">
          {selectedPlan.interval === "lifetime" ? (
            <>One payment of {selectedPlan.display}. No renewal, ever.</>
          ) : (
            <>
              {selectedPlan.display} now, then {selectedPlan.display}{" "}
              {RECURS[selectedPlan.interval]}. Cancel anytime.
            </>
          )}
          <br />
          Card, bank transfer, or USSD.
        </p>
      </div>

      <p className="mt-4 px-2 text-center text-[12px] leading-relaxed text-ink-muted">
        Your training log stays yours whether you subscribe or not — nothing is
        deleted if you decide not to continue.{" "}
        <a
          href="mailto:support@adimfit.com?subject=AdimFit%20refund%20request"
          className="underline underline-offset-4 transition-colors hover:text-ink"
        >
          Request a refund
        </a>
        .
      </p>
    </div>
  );
}