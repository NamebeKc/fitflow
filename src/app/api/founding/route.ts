// src/app/api/founding/route.ts
import { NextResponse } from "next/server";

import { getFoundingStatus } from "@/lib/billing-admin";
import { FOUNDING_LIMIT } from "@/lib/subscription";

/**
 * How many founding seats are left.
 *
 * Public and unauthenticated: it is a marketing number shown on the
 * paywall before anyone signs in, and it reveals nothing about any
 * individual. The counter document itself stays server-only — the
 * browser cannot read `config/founding` directly, which keeps the
 * Firestore rules closed by default.
 *
 * Cached for a minute. The number moves slowly, and a paywall that
 * hits Firestore on every render to print "142 left" is paying for
 * precision nobody can perceive.
 *
 * ON FAILURE IT RETURNS NULLS RATHER THAN A GUESS. Defaulting to zero
 * claimed would advertise 200 seats remaining, overstating scarcity
 * at exactly the moment the data is untrustworthy. The paywall omits
 * the line instead.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getFoundingStatus();
    return NextResponse.json(status, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  } catch (error) {
    console.error("[founding] Status read failed:", error);
    return NextResponse.json({
      claimed: null,
      limit: FOUNDING_LIMIT,
      remaining: null,
    });
  }
}
