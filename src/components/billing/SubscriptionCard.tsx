// src/components/billing/SubscriptionCard.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Gift, Loader2, ShieldCheck, Timer } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { track } from "@/lib/analytics";
import {
  guaranteeEndsAt,
  isComped,
  isEntitled,
  loadBilling,
  PLANS,
  trialDaysLeft,
  withinGuarantee,
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
      <div className="flex items-center gap-3 rounded-lg border border-rule bg-paper-raised p-6">
        <Loader2 className="size-4 animate-spin text-ink-muted" strokeWidth={2} />
        <p className="text-sm text-ink-muted">Checking your subscription…</p>
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
        icon={<Gift className="size-4 text-moss" strokeWidth={2} />}
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
    // Lifetime has no period to renew. Saying "Renews —" to someone
    // who paid precisely so they would never renew again is a small
    // insult with a support email attached.
    const cadence = billing.lifetime
      ? "Yours permanently. Nothing further will ever be charged."
      : `Renews ${formatDate(billing.currentPeriodEnd)}.`;

    // Shown only while it is actually true. A guarantee advertised
    // after it has expired is worse than one never mentioned.
    const refundable = withinGuarantee(billing)
      ? ` Full refund on request until ${formatDate(
          guaranteeEndsAt(billing) ?? undefined,
        )}.`
      : "";

    return (
      <Card
        icon={<ShieldCheck className="size-4 text-moss" strokeWidth={2} />}
        accent
        label="Subscription"
        title={plan ? `${plan.label} · ${plan.display}` : "Active"}
        body={`${cadence}${refundable}`}
      >
        <CancelLink />
      </Card>
    );
  }

  // ── Cancelled but still inside the paid period ───────────────────
  if (billing?.status === "cancelled" && entitled) {
    return (
      <Card
        icon={<Timer className="size-4 text-ink-muted" strokeWidth={2} />}
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
        icon={<Timer className="size-4 text-moss" strokeWidth={2} />}
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
      icon={<Timer className="size-4 text-ink-muted" strokeWidth={2} />}
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
        "rounded-lg border p-6 sm:p-6",
        accent
          ? "border-moss/25 bg-lime-wash"
          : "border-rule bg-paper-raised",
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          {label}
        </p>
      </div>

      <p className="mt-3 text-lg font-semibold tracking-[-0.02em] text-ink">
        {title}
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{body}</p>

      {children && <div className="mt-6">{children}</div>}
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
      className="flex w-full items-center justify-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-semibold text-on-lime outline-none transition-all hover:bg-lime-press focus-visible:ring-2 focus-visible:ring-moss active:translate-y-px"
    >
      {label}
      <ArrowRight className="size-4" strokeWidth={2.5} />
    </button>
  );
}

/**
 * Cancellation.
 *
 * This was a `mailto:`, on the reasoning that Flutterwave has no
 * customer-facing portal for plan-bound subscriptions. That is true,
 * and it is not the same as having no API: a subscription can be
 * found by subscriber email and cancelled outright, which is what
 * `/billing/cancel` does.
 *
 * An email was a dead end on a phone — leave the app, find a mail
 * client, compose a message to a stranger to stop paying. A fair
 * number of people skip that and charge back instead, which costs a
 * fee and a dispute rather than a subscriber.
 */
function CancelLink() {
  return (
    <Link
      href="/billing/cancel"
      className="block text-center text-[13px] text-ink-muted underline underline-offset-4 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised"
    >
      Cancel subscription
    </Link>
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