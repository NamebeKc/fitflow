// src/components/billing/Paywall.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { track } from "@/lib/analytics";
import { PLANS, type PlanId } from "@/lib/subscription";

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
 * Annual is pre-selected because it's the plan that actually retains —
 * weekly and monthly plans churn hard in fitness — but monthly sits
 * right beside it at equal visual weight. Pre-selecting is a nudge;
 * hiding the alternative would be a trick.
 */
export function Paywall({
  headline = "Your trial has ended",
  subline = "Subscribe to keep training with a coach that remembers every session.",
}: PaywallProps) {
  const { user } = useAuth();
  const [currency, setCurrency] = useState<"NGN" | "USD">("USD");
  const [selected, setSelected] = useState<PlanId>("annual_usd");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once the user picks a currency themselves — after that,
  // detection must never override their choice.
  const [userChose, setUserChose] = useState(false);

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
    let cancelled = false;

    function applyCurrency(next: "NGN" | "USD") {
      if (cancelled || userChose) return;
      setCurrency(next);
      setSelected(next === "NGN" ? "annual_ngn" : "annual_usd");
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

  function switchCurrency(next: "NGN" | "USD") {
    setUserChose(true);
    setCurrency(next);
    // Keep the interval, swap the currency.
    const annual = selected.startsWith("annual");
    setSelected(
      next === "NGN"
        ? annual
          ? "annual_ngn"
          : "monthly_ngn"
        : annual
          ? "annual_usd"
          : "monthly_usd",
    );
  }

  const visiblePlans = (
    currency === "NGN"
      ? (["annual_ngn", "monthly_ngn"] as const)
      : (["annual_usd", "monthly_usd"] as const)
  ).map((id) => PLANS[id]);

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

  const included = [
    "Unlimited coaching conversations",
    "Adaptive plans built from your history",
    "Full training log, synced everywhere",
    "Progress tracking and milestones",
  ];

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="rounded-3xl border border-white/[0.09] bg-[#14161A] p-6 sm:p-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#CCFF00]">
          Subscribe
        </p>
        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">
          {headline}
        </h2>
        <p className="mt-2.5 text-[15px] leading-relaxed text-white/60">
          {subline}
        </p>

        {/* Currency */}
        <div className="mt-6 flex rounded-full bg-black/50 p-1">
          {(["NGN", "USD"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => switchCurrency(value)}
              className={cn(
                "flex-1 rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em] outline-none transition-colors",
                currency === value
                  ? "bg-[#CCFF00] text-black"
                  : "text-white/50 hover:text-white/80",
              )}
            >
              {value === "NGN" ? "₦ Naira" : "$ Dollars"}
            </button>
          ))}
        </div>

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
                  "flex w-full items-center gap-3.5 rounded-2xl border px-4 py-4 text-left outline-none transition-all active:scale-[0.99]",
                  "focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50",
                  active
                    ? "border-[#CCFF00]/40 bg-[#CCFF00]/[0.07]"
                    : "border-white/[0.09] bg-black/30 hover:border-white/20",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    active
                      ? "border-[#CCFF00] bg-[#CCFF00]"
                      : "border-white/25",
                  )}
                >
                  {active && (
                    <Check className="size-3 text-black" strokeWidth={3.5} />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-white">
                      {plan.label}
                    </span>
                    {plan.saving && (
                      <span className="rounded-full bg-[#CCFF00]/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#CCFF00]">
                        {plan.saving}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-white/50">
                    Billed {plan.interval === "yearly" ? "yearly" : "monthly"}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span className="block font-mono text-lg tabular-nums text-white">
                    {plan.display}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-200"
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void checkout()}
          disabled={busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-6 py-3.5 text-[15px] font-semibold text-black shadow-[0_10px_40px_-12px_rgba(204,255,0,0.5)] outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#14161A] active:scale-[0.99] disabled:opacity-50"
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

        <p className="mt-3.5 text-center text-[12px] text-white/50">
          Cancel anytime · Card, bank transfer, or USSD
        </p>

        <ul className="mt-6 space-y-2 border-t border-white/[0.07] pt-5">
          {included.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <Check
                className="mt-0.5 size-3.5 shrink-0 text-[#CCFF00]"
                strokeWidth={3}
              />
              <span className="text-[14px] leading-relaxed text-white/60">
                {item}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 px-2 text-center text-[12px] leading-relaxed text-white/50">
        Your training log stays yours whether you subscribe or not. Nothing is
        deleted if you decide not to continue.
      </p>
    </div>
  );
}