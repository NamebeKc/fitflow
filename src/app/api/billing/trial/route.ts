// src/app/api/billing/trial/route.ts
import { NextResponse } from "next/server";

import { getAdminAuth } from "@/lib/firebase-admin";
import { getOrCreateBilling } from "@/lib/billing-admin";

/**
 * Starts the trial clock, or returns the record that already exists.
 *
 * WHY THIS ROUTE EXISTS AT ALL. The trial is created server-side on
 * first read of a billing document, which historically happened on
 * the first gated chat request. `PaywallGate` now runs earlier than
 * that — it decides what to render before the user has sent anything
 * — so a brand-new account would reach the gate with no record, read
 * as unentitled, and be shown a paywall it should never have seen.
 *
 * Calling this from the gate makes the start a deliberate moment
 * rather than a side effect of whichever request happened to touch
 * Firestore first.
 *
 * IDEMPOTENT. `getOrCreateBilling` returns an existing trial,
 * subscription or expired record untouched, so this cannot extend
 * anyone's trial by being called twice — or two hundred times.
 */
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

  try {
    return NextResponse.json(await getOrCreateBilling(uid));
  } catch (error) {
    console.error("[billing/trial] Failed:", uid, error);
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }
}
