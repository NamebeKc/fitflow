// src/components/billing/PaywallGate.tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { track } from "@/lib/analytics";
import { PaywallFlow } from "@/components/billing/PaywallFlow";
import { isEntitled, loadBilling, type BillingRecord } from "@/lib/subscription";

/**
 * ── THE ACCESS GATE ─────────────────────────────────────────────────
 * Sits inside AuthGate: signed in, and either trialing, paying, or
 * out of road.
 *
 * A NEW ACCOUNT HAS NO BILLING RECORD, and a missing record is not
 * the same as an expired one. Reaching the gate with nothing means
 * the trial has not started yet, so the gate starts it rather than
 * refusing entry — see /api/billing/trial. Treating absence as
 * "unentitled" would show a paywall to someone who was promised
 * seven days and has used none of them.
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
 * WHAT IT RENDERS, once the trial really has run out. Not the bare
 * price screen — PaywallFlow, which puts three value screens in front
 * of it. Someone who has just spent a week in the product deserves
 * the case restated, not just a number.
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
  const starting = useRef(false);

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

  /**
   * No record yet — start the trial.
   *
   * Guarded by a ref rather than state so a re-render mid-flight
   * cannot fire a second POST. The route is idempotent anyway; this
   * just avoids the noise.
   *
   * Waits for `profile`, so the clock starts when someone actually
   * enters the product rather than while they are still filling in
   * onboarding.
   */
  useEffect(() => {
    if (!user || billing !== null || !profile || starting.current) return;
    starting.current = true;

    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/billing/trial", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          setBilling((await response.json()) as BillingRecord);
          return;
        }
      } catch (error) {
        console.error("[paywall-gate] Could not start trial:", error);
      }
      // Failed to start. Let them in rather than showing a paywall to
      // someone whose trial we simply failed to create — /api/chat
      // re-derives entitlement server-side and will gate correctly
      // whatever this component believes.
      starting.current = false;
      setBilling({
        status: "trialing",
        trialEndsAt: new Date(Date.now() + 86_400_000).toISOString(),
        updatedAt: new Date().toISOString(),
      });
    })();
  }, [user, billing, profile]);

  // `null` means "looked, found nothing", which the effect above is
  // busy turning into a trial. Keep showing the skeleton until it
  // resolves rather than flashing a paywall in the gap.
  const resolving =
    billing === undefined || profileLoading || (billing === null && !!profile);
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

  // Someone whose trial just ran out needs different words from
  // someone who never had one.
  const expired = billing?.status === "trialing";
  return (
    <PaywallFlow
      headline={
        expired
          ? "Your trial has ended"
          : `Ready when you are, ${profile?.firstName ?? "there"}`
      }
      subline={
        expired
          ? "Keep the coach that already knows your history, your goals and every session you've logged."
          : "Your plan is built. Subscribe to start training with it."
      }
    />
  );
}
