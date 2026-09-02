// src/app/api/billing/checkout/route.ts
import { NextResponse } from "next/server";

import { getAdminAuth } from "@/lib/firebase-admin";
import { updateBilling } from "@/lib/billing-admin";
import { PLANS, type PlanId } from "@/lib/subscription";

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

/** Maps our plan IDs to the plan IDs created in the Flutterwave dashboard. */
function flutterwavePlanId(plan: PlanId): string | undefined {
  const map: Record<PlanId, string | undefined> = {
    monthly_ngn: process.env.FLUTTERWAVE_PLAN_NGN_MONTHLY,
    annual_ngn: process.env.FLUTTERWAVE_PLAN_NGN_ANNUAL,
    monthly_usd: process.env.FLUTTERWAVE_PLAN_USD_MONTHLY,
    annual_usd: process.env.FLUTTERWAVE_PLAN_USD_ANNUAL,
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
  const flwPlan = flutterwavePlanId(planId);

  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret || !flwPlan) {
    console.error("[billing/checkout] Missing Flutterwave configuration");
    return NextResponse.json(
      { error: "Payments aren't configured yet. Please try again later." },
      { status: 503 },
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://myfitflow.pro";

  // tx_ref must be unique per attempt and lets us tie the callback
  // back to this user without trusting the redirect's query string.
  const txRef = `fitflow-${uid}-${Date.now()}`;

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
        payment_plan: flwPlan,
        redirect_url: `${appUrl}/billing/return`,
        customer: { email },
        customizations: {
          title: "Fitflow",
          description: `Fitflow ${plan.label} subscription`,
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