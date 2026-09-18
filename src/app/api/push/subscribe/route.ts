// src/app/api/push/subscribe/route.ts
import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

/**
 * Stores a device's push subscription and reminder preference.
 *
 * Subscriptions are per-DEVICE, not per-user: someone with a phone and
 * a laptop has two, and both should receive the reminder. They're keyed
 * by a hash of the endpoint so re-subscribing on the same device
 * updates rather than duplicating — duplicates mean the same reminder
 * arriving twice, which is how notification permission gets revoked.
 */

interface SubscribeBody {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  hour?: number;
  timeZone?: string;
}

/** Stable short id for an endpoint URL, usable as a document key. */
function endpointKey(endpoint: string): string {
  let hash = 2166136261;
  for (let i = 0; i < endpoint.length; i += 1) {
    hash ^= endpoint.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash).toString(36);
}

async function requireUid(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    return (await getAdminAuth().verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const uid = await requireUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: SubscribeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const subscription = body.subscription;
  if (
    !subscription?.endpoint ||
    !subscription.keys?.p256dh ||
    !subscription.keys.auth
  ) {
    return NextResponse.json(
      { error: "Incomplete subscription." },
      { status: 400 },
    );
  }

  // Clamp rather than reject: a bad hour is not worth failing over.
  const hour =
    typeof body.hour === "number" && body.hour >= 0 && body.hour <= 23
      ? Math.floor(body.hour)
      : 18;

  const timeZone =
    typeof body.timeZone === "string" && body.timeZone ? body.timeZone : "UTC";

  try {
    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);

    await userRef
      .collection("push")
      .doc(endpointKey(subscription.endpoint))
      .set({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updatedAt: new Date().toISOString(),
      });

    // The preference is shared across devices — someone who wants an
    // 18:00 reminder wants it at 18:00 everywhere.
    await userRef.collection("settings").doc("reminders").set(
      {
        enabled: true,
        hour,
        timeZone,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    return NextResponse.json({ subscribed: true });
  } catch (error) {
    console.error("[push/subscribe] Failed:", error);
    return NextResponse.json(
      { error: "Couldn't save your reminder. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const uid = await requireUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);

    // Remove every device, not just this one. Someone turning
    // reminders off means off — not "off on the device I happen to be
    // holding".
    const devices = await userRef.collection("push").get();
    await Promise.all(devices.docs.map((doc) => doc.ref.delete()));

    await userRef
      .collection("settings")
      .doc("reminders")
      .set(
        { enabled: false, updatedAt: new Date().toISOString() },
        { merge: true },
      );

    return NextResponse.json({ unsubscribed: true });
  } catch (error) {
    console.error("[push/subscribe] Delete failed:", error);
    return NextResponse.json(
      { error: "Couldn't turn reminders off." },
      { status: 500 },
    );
  }
}