// src/app/api/billing/cancel/route.ts
import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getOrCreateBilling, updateBilling } from "@/lib/billing-admin";
import { trackServer } from "@/lib/analytics-server";
import { isLifetimePlan } from "@/lib/subscription";

const FLW_API = "https://api.flutterwave.com/v3";

/**
 * ── CANCELLATION ────────────────────────────────────────────────────
 * Replaces a `mailto:` link. The old comment on it said Flutterwave
 * has no customer-facing portal for plan-bound subscriptions, which is
 * true and is not the same thing as having no API: a subscription can
 * be found by the subscriber's email and cancelled outright.
 *
 *   GET  /v3/subscriptions?email=…&status=active   -> data[].id
 *   PUT  /v3/subscriptions/{id}/cancel
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE: never write
 * `status: "cancelled"` unless Flutterwave has confirmed it, or has
 * confirmed there was nothing to cancel.
 *
 * A local flag that says "cancelled" while the card keeps being
 * charged is strictly worse than the mailto it replaces. The customer
 * stops watching, the charge lands anyway, and the first they hear of
 * it is their bank. Every failure path below therefore leaves the
 * subscription ACTIVE, records the attempt so it is not lost, and
 * tells the user plainly that it did not go through.
 *
 * WHY THE EMAIL LOOKUP. `BillingRecord.flwSubscriptionId` has existed
 * since the schema was written, with the comment "needed to cancel",
 * and nothing has ever written it — not checkout, not verify, not the
 * webhook. So there is no stored id to cancel by. The lookup is how
 * that gap is covered, and this route backfills the id on success so
 * the next cancellation is one call instead of two.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Flutterwave's own cap is higher; this is a sanity bound. */
const MAX_SUBSCRIPTIONS = 20;
const FLW_TIMEOUT_MS = 12_000;

interface FlwSubscription {
  id?: number;
  status?: string;
  customer?: { customer_email?: string };
}

async function flw(path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FLW_TIMEOUT_MS);
  try {
    return await fetch(`${FLW_API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Every active subscription Flutterwave holds for this email.
 *
 * Plural on purpose. Someone who cancelled and resubscribed, or who
 * was charged twice through a retry, can hold more than one, and
 * cancelling only the first would leave a live mandate behind.
 */
async function activeSubscriptions(email: string): Promise<number[]> {
  const response = await flw(
    `/subscriptions?email=${encodeURIComponent(email)}&status=active`,
  );
  if (!response.ok) {
    throw new Error(`lookup failed: ${response.status}`);
  }
  const payload = (await response.json()) as {
    status?: string;
    data?: FlwSubscription[];
  };
  if (payload.status !== "success" || !Array.isArray(payload.data)) {
    throw new Error("lookup returned an unexpected shape");
  }
  return payload.data
    .filter((s) => typeof s.id === "number")
    .filter((s) => (s.status ?? "active").toLowerCase() === "active")
    .slice(0, MAX_SUBSCRIPTIONS)
    .map((s) => s.id as number);
}

/** Leaves a durable trace of an attempt that could not complete. */
async function recordFailure(
  uid: string,
  reason: string,
  note: string,
  detail: string,
) {
  try {
    await getAdminDb()
      .collection("cancellationRequests")
      .doc(uid)
      .set(
        {
          uid,
          reason,
          note,
          detail,
          resolved: false,
          requestedAt: new Date().toISOString(),
        },
        { merge: true },
      );
  } catch (error) {
    // The user is already being told to contact support; failing to
    // write the breadcrumb must not turn that into a 500.
    console.error("[billing/cancel] Could not record request:", uid, error);
  }
}

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json(
      { error: "Your session has expired. Please sign in again." },
      { status: 401 },
    );
  }

  let reason = "";
  let note = "";
  try {
    const body = (await request.json()) as { reason?: string; note?: string };
    reason = String(body.reason ?? "").slice(0, 60);
    note = String(body.note ?? "").slice(0, 1000);
  } catch {
    // A cancellation with no reason attached is still a cancellation.
  }

  if (!process.env.FLUTTERWAVE_SECRET_KEY) {
    console.error("[billing/cancel] FLUTTERWAVE_SECRET_KEY missing");
    return NextResponse.json(
      { error: "Cancellation is unavailable right now.", support: true },
      { status: 503 },
    );
  }

  let billing;
  try {
    billing = await getOrCreateBilling(uid);
  } catch (error) {
    console.error("[billing/cancel] Could not read billing:", uid, error);
    return NextResponse.json(
      { error: "Couldn't reach your subscription. Please try again." },
      { status: 503 },
    );
  }

  // ── Nothing to cancel ────────────────────────────────────────────
  if (billing.status === "cancelled") {
    // Idempotent: a double submit, or a back button, is not an error.
    return NextResponse.json({
      cancelled: true,
      alreadyCancelled: true,
      accessUntil: billing.currentPeriodEnd ?? null,
    });
  }

  if (billing.lifetime || (billing.plan && isLifetimePlan(billing.plan))) {
    return NextResponse.json(
      {
        error:
          "A lifetime plan has no recurring charge, so there is nothing to cancel. Your access doesn't expire.",
      },
      { status: 400 },
    );
  }

  if (billing.status === "trialing") {
    // No card is on file during the trial, so nothing can be charged.
    // Letting it lapse IS the cancellation; say so rather than
    // pretending to call a processor that has never heard of them.
    return NextResponse.json(
      {
        error:
          "You're on the free trial and no card is on file, so there's nothing to cancel. Access simply ends when the trial does.",
      },
      { status: 400 },
    );
  }

  if (billing.status !== "active" && billing.status !== "past_due") {
    return NextResponse.json(
      { error: "There's no active subscription on this account." },
      { status: 400 },
    );
  }

  const email = billing.billingEmail;
  if (!email) {
    await recordFailure(uid, reason, note, "no billingEmail on record");
    return NextResponse.json(
      {
        error:
          "We couldn't match your subscription automatically. We've logged the request — email support@adimfit.com and we'll cancel it by hand.",
        support: true,
      },
      { status: 409 },
    );
  }

  // ── Find it, then cancel it ──────────────────────────────────────
  let ids: number[];
  try {
    ids = await activeSubscriptions(email);
  } catch (error) {
    console.error("[billing/cancel] Lookup failed:", uid, error);
    await recordFailure(uid, reason, note, `lookup: ${String(error)}`);
    return NextResponse.json(
      {
        error:
          "We couldn't reach the payment provider. Nothing has changed — your subscription is still active. We've logged the request; try again shortly or email support@adimfit.com.",
        support: true,
      },
      { status: 502 },
    );
  }

  const failed: number[] = [];
  for (const id of ids) {
    try {
      const response = await flw(`/subscriptions/${id}/cancel`, {
        method: "PUT",
      });
      if (!response.ok) {
        failed.push(id);
        console.error(
          "[billing/cancel] Cancel rejected:",
          uid,
          id,
          response.status,
        );
      }
    } catch (error) {
      failed.push(id);
      console.error("[billing/cancel] Cancel threw:", uid, id, error);
    }
  }

  if (failed.length > 0) {
    await recordFailure(
      uid,
      reason,
      note,
      `provider refused ids ${failed.join(",")}`,
    );
    return NextResponse.json(
      {
        error:
          "The payment provider didn't confirm the cancellation, so we've left your subscription active rather than tell you it's done. We've logged this — email support@adimfit.com and we'll finish it by hand.",
        support: true,
      },
      { status: 502 },
    );
  }

  // Zero active subscriptions is a legitimate outcome, not a failure:
  // a one-off charge, or a mandate that already lapsed. Nothing can be
  // charged again, so recording the cancellation is honest. The flag
  // is persisted so support can tell the two cases apart later.
  const foundAtProvider = ids.length > 0;

  try {
    await updateBilling(uid, {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      ...(reason ? { cancelReason: reason } : {}),
      ...(note ? { cancelNote: note } : {}),
      ...(foundAtProvider ? { flwSubscriptionId: ids[0] } : {}),
      providerSubscriptionFound: foundAtProvider,
    });
  } catch (error) {
    // The provider side is already done, so the money is stopped. A
    // write failure here is a reporting problem, not a billing one,
    // but it must not read to the user as success.
    console.error("[billing/cancel] Provider cancelled, write failed:", uid, error);
    await recordFailure(uid, reason, note, `local write: ${String(error)}`);
    return NextResponse.json(
      {
        error:
          "Your subscription was cancelled with the payment provider, but we couldn't update your account. Nothing further will be charged. Email support@adimfit.com so we can tidy the record.",
        support: true,
      },
      { status: 500 },
    );
  }

  await trackServer(uid, "subscription_cancelled", {
    plan: billing.plan ?? null,
    reason: reason || null,
    provider_subscription_found: foundAtProvider,
    had_note: note.length > 0,
  });

  return NextResponse.json({
    cancelled: true,
    accessUntil: billing.currentPeriodEnd ?? null,
  });
}
