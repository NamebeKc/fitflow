// src/app/api/account/delete/route.ts
import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getBilling } from "@/lib/billing-admin";
import { isEntitled } from "@/lib/subscription";

/**
 * ── ACCOUNT DELETION ────────────────────────────────────────────────
 * Required, not optional. The privacy policy states that deleting an
 * account removes the profile, workout log and coach conversations —
 * so the absence of this endpoint was a promise the product could not
 * keep, and under NDPR a right-to-erasure obligation left unmet.
 *
 * Deletion is irreversible and total: the whole `users/{uid}` subtree
 * plus the Firebase Auth record. No soft-delete, no tombstone. A user
 * who asks to be forgotten should be forgotten.
 *
 * ONE DELIBERATE REFUSAL: an account with an active paid subscription
 * cannot be deleted here. Flutterwave bills against the customer's
 * email independently of anything in our database, so removing the
 * account would leave someone paying for a product they can no longer
 * reach and no record on our side explaining why. They are asked to
 * cancel first — which is friction, but far better than silent
 * charges.
 * ─────────────────────────────────────────────────────────────────────
 */

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let uid: string;
  try {
    // `checkRevoked: true` — deleting an account is destructive enough
    // that a token issued before a password change shouldn't work.
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    uid = decoded.uid;
  } catch (error) {
    console.error("[account/delete] Token verification failed:", error);
    return NextResponse.json(
      { error: "Your session has expired. Sign in again and retry." },
      { status: 401 },
    );
  }

  // ── Refuse while a subscription is live ──────────────────────────
  try {
    const billing = await getBilling(uid);
    if (
      billing &&
      billing.status === "active" &&
      isEntitled(billing) &&
      !billing.compedUntil
    ) {
      return NextResponse.json(
        {
          error:
            "Cancel your subscription before deleting your account, or you'll keep being charged. Email support@adimfit.com and we'll cancel it for you.",
          reason: "active_subscription",
        },
        { status: 409 },
      );
    }
  } catch (error) {
    // A billing read failure must not become a reason to refuse
    // erasure — that would make a technical fault into a rights
    // violation. Log it and continue.
    console.error("[account/delete] Billing check failed:", error);
  }

  // ── Delete everything ────────────────────────────────────────────
  try {
    const db = getAdminDb();
    const userRef = db.collection("users").doc(uid);

    // recursiveDelete clears the document AND every subcollection —
    // workouts, messages, plans, measurements, billing. Deleting the
    // document alone would orphan all of them, leaving the data in
    // place while appearing to have removed it.
    await db.recursiveDelete(userRef);

    // The auth record last: if this succeeded first and the data
    // delete then failed, the data would be unreachable AND
    // undeletable, since nobody could ever authenticate as that uid
    // again.
    await getAdminAuth().deleteUser(uid);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[account/delete] Deletion failed:", error);
    return NextResponse.json(
      {
        error:
          "We couldn't complete the deletion. Nothing was partially removed — please try again, or email support@adimfit.com.",
      },
      { status: 500 },
    );
  }
}