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
   * Currency detection, in two passes.
   *
   * The TIMEZONE runs first because it's instant, needs no network,
   * and survives a VPN that doesn't also change the system clock —
   * `Africa/Lagos` is about as clear a signal as exists.
   *
   * The server header check follows as confirmation. It usually
   * returns nothing on plain Cloud Run, but will start working if a
   * load balancer or CDN is ever put in front.
   *
   * Neither decides anything permanent: the toggle sits directly
   * above the plans, so a wrong guess costs a single tap.
   */
  useEffect(() => {
    // Nothing to detect when only one currency can be collected.
    if (ENABLED_CURRENCIES.length < 2) return;

    let cancelled = false;

    function applyCurrency(next: Currency) {
      if (cancelled || userChose) return;
      setCurrency(next);
      setSelected(DEFAULT_PLAN[next]);
    }

    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
      if (zone === "Africa/Lagos") {
        applyCurrency("NGN");
        return;
      }
    } catch {
      // Older browsers may not expose the zone — fall through.
    }

    fetch("/api/geo")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { currency?: string | null } | null) => {
        if (data?.currency === "NGN") applyCurrency("NGN");
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
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-indigo">
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
                className="mt-0.5 size-3.5 shrink-0 text-indigo"
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
          <p className="mt-6 rounded-md border border-indigo/20 bg-indigo/[0.05] px-3.5 py-2.5 text-center text-[13px] leading-relaxed text-indigo">
            Founding member pricing — {seatsLeft} of {FOUNDING_LIMIT} seats
            left
            <span className="mt-0.5 block text-[12px] text-ink-muted">
              Half price, locked for as long as you stay subscribed.
            </span>
          </p>
        )}

        {/*
          The toggle only appears when there is something to toggle TO.
          With international collection not yet approved, offering a
          dollar price would let a customer choose a plan that cannot
          be charged.
        */}
        {ENABLED_CURRENCIES.length > 1 && (
          <div className="mt-6 flex rounded-full bg-paper p-1">
            {ENABLED_CURRENCIES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => switchCurrency(value)}
                className={cn(
                  "flex-1 rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] outline-none transition-colors",
                  currency === value
                    ? "bg-indigo text-on-indigo"
                    : "text-ink-muted hover:text-ink",
                )}
              >
                {value === "NGN" ? "₦ Naira" : "$ Dollars"}
              </button>
            ))}
          </div>
        )}

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
                  "focus-visible:ring-2 focus-visible:ring-indigo/50",
                  active
                    ? "border-indigo/40 bg-indigo/[0.07]"
                    : "border-rule bg-paper-sunken hover:border-rule",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    active
                      ? "border-indigo bg-indigo"
                      : "border-rule",
                  )}
                >
                  {active && (
                    <Check className="size-3 text-on-indigo" strokeWidth={3.5} />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[15px] font-semibold text-ink">
                      {plan.label}
                    </span>
                    {plan.saving && (
                      <span className="rounded-full bg-indigo/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-indigo">
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
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-indigo px-6 py-3.5 text-[15px] font-semibold text-on-indigo outline-none transition-all hover:bg-indigo-lift focus-visible:ring-2 focus-visible:ring-indigo/60 focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:translate-y-px disabled:opacity-50"
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
        <div className="mt-4 rounded-md border border-indigo/20 bg-indigo/[0.05] px-3.5 py-3 text-center">
          <p className="text-[13px] font-medium leading-relaxed text-indigo">
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