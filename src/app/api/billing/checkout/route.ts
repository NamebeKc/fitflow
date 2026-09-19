// src/app/api/billing/checkout/route.ts
import { NextResponse } from "next/server";

import { getAdminAuth } from "@/lib/firebase-admin";
import { updateBilling } from "@/lib/billing-admin";
import {
  PLANS,
  isCurrencyEnabled,
  mintTxRef,
  type PlanId,
} from "@/lib/subscription";

/**
 * Starts a subscription.
 *
 * Creates a Flutterwave hosted checkout link bound to a payment plan.
 * When the customer completes that first charge, Flutterwave
 * subscribes them to the plan and handles every renewal afterwards.
 *
 * PRICE IS NEVER TAKEN FROM THE REQUEST. The client sends a plan ID
 * and nothing else; the amount is looked up server-side. Accepting an
 * amount from the browser is how people end up subscribing for ₦1.
 */

const FLW_API = "https://api.flutterwave.com/v3";

/**
 * Maps our plan IDs to the payment plans created in the Flutterwave
 * dashboard.
 *
 * Lifetime plans are deliberately absent: a lifetime purchase is a
 * single charge, not a subscription, so it goes through the same
 * `/payments` call with no `payment_plan` attached. Attaching one
 * would enrol the customer in a recurring charge for something sold
 * as a one-off.
 *
 * The retired annual plans are kept so that anyone still on one can be
 * renewed by the webhook, but they are unreachable from the paywall.
 */
function flutterwavePlanId(plan: PlanId): string | undefined {
  const map: Record<PlanId, string | undefined> = {
    weekly_ngn: process.env.FLUTTERWAVE_PLAN_NGN_WEEKLY,
    monthly_ngn: process.env.FLUTTERWAVE_PLAN_NGN_MONTHLY,
    annual_ngn_2026: process.env.FLUTTERWAVE_PLAN_NGN_ANNUAL_2026,
    lifetime_ngn: undefined,
    weekly_usd: process.env.FLUTTERWAVE_PLAN_USD_WEEKLY,
    monthly_usd: process.env.FLUTTERWAVE_PLAN_USD_MONTHLY,
    annual_usd_2026: process.env.FLUTTERWAVE_PLAN_USD_ANNUAL_2026,
    lifetime_usd: undefined,
    // Retired: unreachable, because checkout returns 410 before it
    // ever asks for a plan ID. Listed for the record.
    annual_ngn: undefined,
    annual_usd: undefined,
  };
  return map[plan];
}

export async function POST(request: Request) {
  // ── Authenticate ─────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let uid: string;
  let email: string | undefined;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
    email = decoded.email;
  } catch (error) {
    console.error("[billing/checkout] Token verification failed:", error);
    return NextResponse.json(
      { error: "Your session has expired. Please sign in again." },
      { status: 401 },
    );
  }

  if (!email) {
    return NextResponse.json(
      { error: "Your account needs an email address to subscribe." },
      { status: 400 },
    );
  }

  // ── Resolve the plan (server-side pricing) ───────────────────────
  let body: { plan?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const planId = body.plan as PlanId | undefined;
  if (!planId || !(planId in PLANS)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  const plan = PLANS[planId];

  // A retired plan is still honoured for renewals but must never be
  // sold again — otherwise an old price stays purchasable forever to
  // anyone who keeps the plan ID.
  if (plan.retired) {
    return NextResponse.json(
      { error: "That plan is no longer available." },
      { status: 410 },
    );
  }

  // Re-checked server-side. The paywall already hides currencies we
  // cannot collect, but the paywall is a browser component and a plan
  // ID can be posted directly. A clear 409 beats a Flutterwave 502
  // that the customer reads as their card being declined.
  if (!isCurrencyEnabled(plan.currency)) {
    return NextResponse.json(
      { error: "That currency isn't available yet. Please pick another plan." },
      { status: 409 },
    );
  }

  const lifetime = plan.interval === "lifetime";
  const flwPlan = flutterwavePlanId(planId);

  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret || (!lifetime && !flwPlan)) {
    console.error("[billing/checkout] Missing Flutterwave configuration");
    return NextResponse.json(
      { error: "Payments aren't configured yet. Please try again later." },
      { status: 503 },
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://adimfit.com";

  // tx_ref must be unique per attempt and lets us tie the callback
  // back to this user without trusting the redirect's query string.
  // Minted through subscription.ts so the prefix can never drift out
  // of step with the check in the verify route again.
  const txRef = mintTxRef(uid);

  try {
    const response = await fetch(`${FLW_API}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: plan.amount,
        currency: plan.currency,
        // Omitted entirely for lifetime — see flutterwavePlanId().
        ...(lifetime ? {} : { payment_plan: flwPlan }),
        redirect_url: `${appUrl}/billing/return`,
        customer: { email },
        customizations: {
          title: "AdimFit",
          description: lifetime
            ? "AdimFit Lifetime — one payment"
            : `AdimFit ${plan.label} subscription`,
          logo: `${appUrl}/logo.png`,
        },
        meta: { uid, plan: planId },
      }),
    });

    const data = await response.json();

    if (!response.ok || data.status !== "success" || !data.data?.link) {
      console.error("[billing/checkout] Flutterwave rejected:", data);
      return NextResponse.json(
        { error: "Couldn't start checkout. Please try again." },
        { status: 502 },
      );
    }

    // Record the email BEFORE redirecting. Webhooks identify customers
    // by email, so without this the renewal event has no account to
    // attach to.
    await updateBilling(uid, {
      billingEmail: email.toLowerCase(),
      plan: planId,
    });

    return NextResponse.json({ link: data.data.link });
  } catch (error) {
    console.error("[billing/checkout] Request failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the payment provider. Please try again." },
      { status: 502 },
    );
  }
}