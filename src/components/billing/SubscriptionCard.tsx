// src/components/billing/SubscriptionCard.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Gift, Loader2, ShieldCheck, Timer } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { track } from "@/lib/analytics";
import {
  isComped,
  isEntitled,
  loadBilling,
  PLANS,
  trialDaysLeft,
  type BillingRecord,
} from "@/lib/subscription";

/**
 * Subscription status.
 *
 * Four states, each needing a different thing said:
 *   comped   — access granted outside billing; say so honestly
 *   trialing — days remaining, with a way to subscribe early
 *   active   — plan, renewal date, and how to cancel
 *   lapsed   — trial over or payment failed; route to the paywall
 *
 * Cancellation is a plain link, not hidden behind a support email. A
 * subscription that's hard to leave is a subscription people resent,
 * and resentment shows up as chargebacks rather than retention.
 */
export function SubscriptionCard({ onSubscribe }: { onSubscribe: () => void }) {
  const { user } = useAuth();
  const [billing, setBilling] = useState<BillingRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    loadBilling(user.uid)
      .then((record) => {
        if (!cancelled) setBilling(record);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-3xl border border-white/[0.07] bg-[#14161A] p-5">
        <Loader2 className="size-4 animate-spin text-white/50" strokeWidth={2} />
        <p className="text-sm text-white/50">Checking your subscription…</p>
      </div>
    );
  }

  const comped = isComped(billing);
  const entitled = isEntitled(billing);
  const daysLeft = trialDaysLeft(billing);
  const plan = billing?.plan ? PLANS[billing.plan] : null;

  // ── Complimentary ────────────────────────────────────────────────
  if (comped) {
    return (
      <Card
        icon={<Gift className="size-4 text-[#CCFF00]" strokeWidth={2} />}
        accent
        label="Complimentary access"
        title="You're on the house"
        body={`Full access until ${formatDate(billing?.compedUntil)}. No payment needed${
          billing?.compedReason ? ` — ${billing.compedReason}.` : "."
        }`}
      />
    );
  }

  // ── Active subscription ──────────────────────────────────────────
  if (billing?.status === "active" && entitled) {
    return (
      <Card
        icon={<ShieldCheck className="size-4 text-[#CCFF00]" strokeWidth={2} />}
        accent
        label="Subscription"
        title={plan ? `${plan.label} · ${plan.display}` : "Active"}
        body={`Renews ${formatDate(billing.currentPeriodEnd)}.`}
      >
        <CancelLink />
      </Card>
    );
  }

  // ── Cancelled but still inside the paid period ───────────────────
  if (billing?.status === "cancelled" && entitled) {
    return (
      <Card
        icon={<Timer className="size-4 text-white/60" strokeWidth={2} />}
        label="Subscription"
        title="Cancelled"
        body={`You keep full access until ${formatDate(
          billing.currentPeriodEnd,
        )}. Nothing further will be charged.`}
      >
        <SubscribeButton onSubscribe={onSubscribe} label="Resubscribe" />
      </Card>
    );
  }

  // ── Trial ────────────────────────────────────────────────────────
  if (billing?.status === "trialing" && entitled) {
    return (
      <Card
        icon={<Timer className="size-4 text-[#CCFF00]" strokeWidth={2} />}
        accent={daysLeft <= 3}
        label="Free trial"
        title={`${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
        body={
          daysLeft <= 3
            ? `Your trial ends ${formatDate(billing.trialEndsAt)}. Subscribe to keep your coach and your history.`
            : `Full access until ${formatDate(billing.trialEndsAt)}. No card needed until then.`
        }
      >
        <SubscribeButton onSubscribe={onSubscribe} label="Subscribe now" />
      </Card>
    );
  }

  // ── Payment failed ───────────────────────────────────────────────
  if (billing?.status === "past_due") {
    return (
      <Card
        icon={<Timer className="size-4 text-orange-300" strokeWidth={2} />}
        label="Payment issue"
        title="We couldn't take your payment"
        body="Your card was declined. Access continues for a few days while we retry — updating your payment method will fix it."
      >
        <SubscribeButton onSubscribe={onSubscribe} label="Update payment" />
      </Card>
    );
  }

  // ── Expired ──────────────────────────────────────────────────────
  return (
    <Card
      icon={<Timer className="size-4 text-white/60" strokeWidth={2} />}
      label="Subscription"
      title="No active subscription"
      body="Your training log is safe and nothing has been deleted. Subscribe to start coaching again."
    >
      <SubscribeButton onSubscribe={onSubscribe} label="Subscribe" />
    </Card>
  );
}

function Card({
  icon,
  label,
  title,
  body,
  accent = false,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  body: string;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-3xl border p-5 sm:p-6",
        accent
          ? "border-[#CCFF00]/20 bg-[#CCFF00]/[0.04]"
          : "border-white/[0.07] bg-[#14161A]",
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          {label}
        </p>
      </div>

      <p className="mt-3 text-lg font-semibold tracking-[-0.02em] text-white">
        {title}
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-white/60">{body}</p>

      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}

function SubscribeButton({
  onSubscribe,
  label,
}: {
  onSubscribe: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        track("paywall_shown", { trigger: "profile" });
        onSubscribe();
      }}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-5 py-3 text-sm font-semibold text-black outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 active:scale-[0.99]"
    >
      {label}
      <ArrowRight className="size-4" strokeWidth={2.5} />
    </button>
  );
}

/**
 * Cancellation.
 *
 * Flutterwave has no customer-facing portal for subscriptions bound to
 * a payment plan, so this is a support request rather than a button.
 * Being upfront that it's an email — with the subject pre-filled — is
 * better than a button that silently opens a support ticket.
 */
function CancelLink() {
  return (
    <a
      href="mailto:support@adimfit.com?subject=Cancel%20my%20AdimFit%20subscription"
      className="block text-center text-[13px] text-white/50 underline underline-offset-4 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
    >
      Cancel subscription
    </a>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}