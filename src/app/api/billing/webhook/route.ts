// src/app/api/billing/webhook/route.ts
import { NextResponse } from "next/server";

import {
  claimFoundingSeat,
  findUidByBillingEmail,
  getBilling,
  periodEndFor,
  updateBilling,
} from "@/lib/billing-admin";
import { PLANS, isLifetimePlan, type PlanId } from "@/lib/subscription";
import { trackServer } from "@/lib/analytics-server";
import { sendOnce } from "@/lib/email/mailer";
import { recipientFor } from "@/lib/email/recipient";
import { cancelled, paymentFailed } from "@/lib/email/templates";

/**
 * Flutterwave webhook.
 *
 * This is how renewals reach us. The verify route only covers the
 * first payment — every subsequent monthly charge happens on
 * Flutterwave's schedule with nobody's browser involved, so without
 * this endpoint paying customers would silently lose access at the
 * end of their first period.
 *
 * AUTHENTICATION: Flutterwave sends a `verif-hash` header containing
 * the secret hash configured in the dashboard. A request without a
 * matching hash is rejected outright — this endpoint is public, and
 * anything it accepts on trust grants free subscriptions.
 */

export async function POST(request: Request) {
  const signature = request.headers.get("verif-hash");
  const expected = process.env.FLUTTERWAVE_SECRET_HASH;

  if (!expected) {
    console.error("[billing/webhook] FLUTTERWAVE_SECRET_HASH not set");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  if (!signature || signature !== expected) {
    console.warn("[billing/webhook] Rejected unsigned request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: {
    event?: string;
    "event.type"?: string;
    data?: Record<string, unknown>;
  };
  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const type = event.event ?? event["event.type"] ?? "";
  const data = event.data ?? {};

  try {
    const customer = data.customer as { email?: string } | undefined;
    const email = customer?.email?.toLowerCase();

    if (!email) {
      // Nothing actionable without an email to resolve.
      return NextResponse.json({ received: true });
    }

    const uid = await findUidByBillingEmail(email);
    if (!uid) {
      console.warn("[billing/webhook] No account for", email);
      // 200 regardless: a non-2xx makes Flutterwave retry an event we
      // will never be able to process.
      return NextResponse.json({ received: true });
    }

    // ── Successful charge: extend the paid period ─────────────────
    if (
      type === "charge.completed" &&
      String(data.status).toLowerCase() === "successful"
    ) {
      const existing = await getBilling(uid);
      const meta = data.meta as { plan?: string } | undefined;
      const planId = (meta?.plan ?? existing?.plan) as PlanId | undefined;

      if (!planId || !(planId in PLANS)) {
        console.warn("[billing/webhook] Unknown plan for", uid);
        return NextResponse.json({ received: true });
      }

      // A lifetime buyer is already permanently entitled. Flutterwave
      // should never send a renewal for a one-off charge, but if a
      // duplicate or a later unrelated charge arrives, overwriting the
      // record with a dated period would REVOKE access they paid for.
      // Leave it alone.
      if (existing?.lifetime) {
        return NextResponse.json({ received: true });
      }

      // Renewals extend from the CURRENT period end, not from now —
      // otherwise a charge that lands a day early silently shortens
      // the customer's year.
      const base =
        existing?.currentPeriodEnd &&
        new Date(existing.currentPeriodEnd) > new Date()
          ? new Date(existing.currentPeriodEnd)
          : new Date();

      const renewing = existing?.status === "active";

      if (isLifetimePlan(planId)) {
        // The first (and only) charge for a lifetime plan, arriving by
        // webhook because the customer closed the tab before the
        // verify route ran.
        await updateBilling(uid, {
          status: "active",
          plan: planId,
          lifetime: true,
          lastPaymentAt: new Date().toISOString(),
        });
      } else {
        await updateBilling(uid, {
          status: "active",
          plan: planId,
          currentPeriodEnd: periodEndFor(planId, base) ?? undefined,
          // Every charge opens a fresh window, renewals included. The
          // renewal nobody wanted is the one that becomes a chargeback.
          lastPaymentAt: new Date().toISOString(),
        });
      }

      // A first activation that arrived by webhook rather than verify
      // still earns its founding seat. Idempotent, so a renewal that
      // reaches this line changes nothing.
      if (!renewing) await claimFoundingSeat(uid);

      // Renewals reach us only here — no browser is involved, so this
      // is the sole opportunity to record them.
      await trackServer(
        uid,
        renewing ? "subscription_renewed" : "subscription_activated",
        { plan: planId, provider: "flutterwave" },
      );

      // A charge landing after a failure is a recovered payment, which
      // is the number that tells you how much churn was involuntary.
      if (existing?.status === "past_due") {
        await trackServer(uid, "subscription_payment_recovered", {
          plan: planId,
        });
      }

      return NextResponse.json({ received: true });
    }

    // ── Failed charge: flag, don't revoke ─────────────────────────
    if (
      type === "charge.completed" &&
      String(data.status).toLowerCase() === "failed"
    ) {
      const beforeFailure = await getBilling(uid);
      await updateBilling(uid, { status: "past_due" });
      await trackServer(uid, "subscription_payment_failed", {
        provider: "flutterwave",
      });

      // TELLING THEM IS THE POINT of flagging rather than revoking. A
      // past_due customer who doesn't know is involuntary churn, and
      // Nigerian cards decline on a first attempt for reasons that
      // have nothing to do with the balance — so the one thing that
      // recovers the payment is the customer knowing to retry.
      //
      // Keyed on the transaction, not the date: next month's failure
      // must notify again, while a webhook retry of THIS failure must
      // not. Wrapped, because a mail problem cannot be allowed to
      // return a non-2xx and make Flutterwave replay the event.
      try {
        const recipient = await recipientFor(uid);
        if (recipient) {
          const meta = data.meta as { plan?: string } | undefined;
          const planId = (beforeFailure?.plan ?? meta?.plan) as
            | PlanId
            | undefined;
          const key = String(
            data.tx_ref ?? data.id ?? new Date().toISOString().slice(0, 10),
          );
          await sendOnce(uid, "payment_failed", key, () =>
            paymentFailed(recipient, {
              planLabel:
                planId && planId in PLANS ? PLANS[planId].label : "AdimFit",
              graceEnds: beforeFailure?.currentPeriodEnd,
            }),
          );
        }
      } catch (error) {
        console.error("[billing/webhook] Payment-failed email failed:", error);
      }

      return NextResponse.json({ received: true });
    }

    // ── Cancellation: access continues to period end ──────────────
    if (type.includes("subscription") && type.includes("cancel")) {
      const priorBilling = await getBilling(uid);
      await updateBilling(uid, { status: "cancelled" });
      await trackServer(uid, "subscription_churned", {
        plan: priorBilling?.plan ?? "unknown",
        provider: "flutterwave",
      });

      // A cancellation can originate at Flutterwave rather than with
      // us — repeated failed charges, or a cancellation in their
      // dashboard — and that path previously confirmed nothing to the
      // customer. `api/billing/cancel` uses the same (uid, kind, key),
      // so whichever path runs first sends and the other no-ops. That
      // is the claim doing its job across two routes, not a duplicate.
      try {
        const recipient = await recipientFor(uid);
        if (recipient) {
          await sendOnce(
            uid,
            "cancelled",
            new Date().toISOString().slice(0, 10),
            () =>
              cancelled(recipient, {
                accessUntil: priorBilling?.currentPeriodEnd,
              }),
          );
        }
      } catch (error) {
        console.error("[billing/webhook] Cancellation email failed:", error);
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[billing/webhook] Handler failed:", error);
    // 500 asks Flutterwave to retry, which is right for a transient
    // failure on our side.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}