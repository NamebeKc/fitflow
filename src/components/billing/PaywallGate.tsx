// src/components/billing/PaywallGate.tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { track } from "@/lib/analytics";
import { Paywall } from "@/components/billing/Paywall";
import { isEntitled, loadBilling, type BillingRecord } from "@/lib/subscription";

/**
 * ── THE HARD PAYWALL ────────────────────────────────────────────────
 * Sits inside AuthGate: signed in, but not yet paid.
 *
 * TWO THINGS DELIBERATELY PASS THROUGH IT.
 *
 * 1. ONBOARDING. A visitor without a profile is let past, because the
 *    paywall has to come AFTER onboarding, not before it. Asking for
 *    money before you have asked someone their goal means pricing a
 *    stranger; asking afterwards means pricing a plan they just
 *    watched you build. That ordering is the single change this whole
 *    paywall rework exists to make, and putting the gate first would
 *    undo it.
 *
 * 2. /profile. Billing, cancellation and account deletion all live
 *    there. A customer who cannot pay must still be able to leave —
 *    a paywall that also traps someone's account is how a support
 *    request becomes a chargeback.
 *
 * ENTITLEMENT IS STILL DECIDED SERVER-SIDE. This gate is a UI
 * affordance, nothing more. Anyone can edit their way past a React
 * conditional, which is why `/api/chat` re-derives entitlement from
 * Firestore on every request and returns 402 regardless of what the
 * browser believes. Removing this component would cost polish, not
 * revenue.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Reachable whether or not the visitor has paid. */
const OPEN_PATHS = ["/profile"];

export function PaywallGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const pathname = usePathname();

  // `undefined` means "not looked yet"; `null` means "no record",
  // which is a real and common state under a hard paywall — most
  // accounts never get a billing document until they pay.
  const [billing, setBilling] = useState<BillingRecord | null | undefined>(
    undefined,
  );
  const announced = useRef(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    loadBilling(user.uid).then((record) => {
      if (!cancelled) setBilling(record);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const resolving = billing === undefined || profileLoading;
  const entitled = !resolving && isEntitled(billing ?? null);
  const open = OPEN_PATHS.some((path) => pathname.startsWith(path));
  const blocked = !resolving && !entitled && Boolean(profile) && !open;

  useEffect(() => {
    if (!blocked || announced.current) return;
    announced.current = true;
    track("paywall_shown", { trigger: "hard_gate" });
  }, [blocked]);

  // Never flash the paywall at a paying customer while their record
  // loads. A subscriber who sees "subscribe" for half a second every
  // time they open the app will eventually email to ask whether they
  // were charged twice.
  if (resolving) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!blocked) return <>{children}</>;

  return (
    <Paywall
      headline={`Ready when you are, ${profile?.firstName ?? "there"}`}
      subline="Your plan is built. Subscribe to start training with it."
    />
  );
}
