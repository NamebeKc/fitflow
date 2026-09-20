// src/app/api/partners/me/route.ts
import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { buildPartnerStats } from "@/lib/partner-stats";

/**
 * The signed-in partner's own numbers.
 *
 * Authenticated by a Firebase ID token, the same mechanism every
 * other authenticated route here uses. The partner's Firebase uid is
 * matched against `partners.authUid`, which is written only by
 * `partner-add.mjs` — so holding an AdimFit account grants nothing on
 * its own. Signing up as an ordinary user and calling this returns
 * 404, because no partner document points at that uid.
 *
 * 404 rather than 403 for a signed-in non-partner: whether a given
 * account is a partner is not something this endpoint should confirm
 * to someone who isn't one.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
    const matches = await getAdminDb()
      .collection("partners")
      .where("authUid", "==", uid)
      .limit(1)
      .get();

    if (matches.empty) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const doc = matches.docs[0];
    return NextResponse.json({
      slug: doc.id,
      ...buildPartnerStats(doc, doc.id),
    });
  } catch (error) {
    console.error("[partners/me] Failed:", uid, error);
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }
}
