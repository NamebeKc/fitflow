// src/app/api/partners/stats/route.ts
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { getAdminDb } from "@/lib/firebase-admin";
import { buildPartnerStats } from "@/lib/partner-stats";

/**
 * A partner's own numbers.
 *
 * AUTHENTICATED BY A BEARER TOKEN IN THE URL, not by a login.
 * Partners are not users — they have no account, and building sign-up,
 * password reset and session handling for ten coaches to look at three
 * numbers would be a worse trade than it sounds. The token is 24 random
 * bytes stored on the partner document, revocable with
 * `partner-add.mjs --rotate-token`, and it grants nothing except these
 * counters.
 *
 * WHAT IT DELIBERATELY NEVER RETURNS. No uid, no email, no per-person
 * row, no `viewToken`. A partner learns how many people converted, not
 * who — the people who signed up through Adura's link did not agree to
 * be identified to Adura, and aggregate counters are all a payout
 * discussion needs.
 *
 * The comparison is timing-safe. A token compared with `===` leaks its
 * prefix to anyone patient enough to measure, and this one authorises
 * reading a payment ledger.
 */

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, which is itself a leak;
  // the length check is unavoidable, so fail it explicitly.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") ?? "").trim().toLowerCase();
  const token = url.searchParams.get("t") ?? "";

  if (!slug || !token) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const snapshot = await getAdminDb().doc(`partners/${slug}`).get();

    // One response for "no such partner" and "wrong token". Telling
    // the difference would turn this into a way to enumerate which
    // partners exist.
    const expected = snapshot.exists
      ? ((snapshot.get("viewToken") as string | undefined) ?? "")
      : "";
    if (!expected || !tokenMatches(token, expected)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json(buildPartnerStats(snapshot, slug));
  } catch (error) {
    console.error("[partners/stats] Failed:", slug, error);
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }
}
