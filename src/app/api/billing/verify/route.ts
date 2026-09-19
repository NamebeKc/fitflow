// src/app/api/billing/verify/route.ts
import { NextResponse } from "next/server";

import { getAdminAuth } from "@/lib/firebase-admin";
import {
  claimFoundingSeat,
  periodEndFor,
  updateBilling,
} from "@/lib/billing-admin";
import {
  PLANS,
  isLifetimePlan,
  txRefBelongsTo,
  type PlanId,
} from "@/lib/subscription";
import { trackServer } from "@/lib/analytics-server";
import { recordReferralConversion } from "@/lib/referral";

/**
 * Confirms a payment after the customer returns from checkout.
 *
 * THE REDIRECT IS NOT PROOF OF PAYMENT. Anyone can visit the return
 * URL with `status=successful` in the query string. The only thing
 * that establishes a payment happened is asking Flutterwave directly,
 * which is what this route does.
 *
 * It also re-checks the amount and currency against our own plan
 * catalogue — a verified transaction for ₦100 is verified, but it
 * isn't a subscription.
 */

const FLW_API = "https://api.flutterwave.com/v3";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch {
    return NextResponse.json(
      { error: "Your session has expired. Please sign in again." },
      { status: 401 },
    );
  }

  let body: { transactionId?: string | number; txRef?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const transactionId = body.transactionId;
  if (!transactionId) {
    return NextResponse.json(
      { error: "Missing transaction reference." },
      { status: 400 },
    );
  }

  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Payments aren't configured." },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(
      `${FLW_API}/transactions/${transactionId}/verify`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const data = await response.json();

    if (data.status !== "success" || data.data?.status !== "successful") {
      return NextResponse.json(
        { error: "That payment didn't complete.", entitled: false },
        { status: 402 },
      );
    }

    const tx = data.data;

    // The transaction must belong to THIS user. Without this check,
    // one person's valid transaction ID could activate another's
    // account. The accepted prefixes live in subscription.ts beside
    // the minting function — they were hardcoded separately here once,
    // drifted apart, and silently 403'd every real payment.
    const ref: string = tx.tx_ref ?? "";
    if (!txRefBelongsTo(ref, uid)) {
      console.error("[billing/verify] tx_ref/uid mismatch:", ref, uid);
      return NextResponse.json(
        { error: "That payment doesn't belong to this account." },
        { status: 403 },
      );
    }

    const planId = tx.meta?.plan as PlanId | undefined;
    if (!planId || !(planId in PLANS)) {
      console.error("[billing/verify] Unknown plan in meta:", tx.meta);
      return NextResponse.json(
        { error: "Couldn't identify the plan." },
        { status: 400 },
      );
    }

    const plan = PLANS[planId];

    // Amount and currency must match what we actually charge.
    //
    // Checked in BOTH directions. An underpayment is the obvious
    // attack, but an OVERcharge means our catalogue has drifted out of
    // sync with the Flutterwave plan — we displayed one price and took
    // another. Silently accepting that hides a billing bug behind a
    // working checkout. A small tolerance absorbs rounding only.
    const expected = plan.amount;
    const paid = Number(tx.amount);
    const tolerance = Math.max(1, expected * 0.01);

    if (
      Math.abs(paid - expected) > tolerance ||
      String(tx.currency).toUpperCase() !== plan.currency
    ) {
      console.error(
        "[billing/verify] Amount mismatch:",
        tx.amount,
        tx.currency,
        "expected",
        plan.amount,
        plan.currency,
      );
      return NextResponse.json(
        { error: "Payment amount didn't match the plan." },
        { status: 400 },
      );
    }

    // A lifetime purchase has no period to end, so it stores the flag
    // instead. Writing both would leave a record that expires, which
    // is precisely what the customer paid not to have.
    const periodEnd = periodEndFor(planId);

    await updateBilling(uid, {
      status: "active",
      plan: planId,
      billingEmail: String(tx.customer?.email ?? "").toLowerCase(),
      ...(isLifetimePlan(planId)
        ? { lifetime: true }
        : { currentPeriodEnd: periodEnd ?? undefined }),
    });

    // Founding seat, after entitlement is written. Never throws.
    await claimFoundingSeat(uid);

    // The affiliate ledger, before the analytics event so the event
    // can carry the partner. Never throws — a bounty that fails to
    // record is a support ticket; a 500 here would read to a customer
    // who has just paid as a failed transaction.
    const referral = await recordReferralConversion(uid, ref);

    // Server-side: a browser could fire this without paying, and ad
    // blockers would lose a share of the conversions that did happen.
    await trackServer(uid, "trial_converted", {
      plan: planId,
      provider: "flutterwave",
      currency: plan.currency,
      amount: plan.amount,
      // Lets PostHog break the monetization funnel down by partner
      // without a second source of truth.
      referral_code: referral.recorded ? referral.partnerSlug : null,
      cohort: referral.recorded ? referral.cohort : null,
    });

    return NextResponse.json({ entitled: true, plan: planId });
  } catch (error) {
    console.error("[billing/verify] Failed:", error);
    return NextResponse.json(
      { error: "Couldn't verify that payment. Please contact support." },
      { status: 502 },
    );
  }
}