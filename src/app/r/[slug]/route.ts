// src/app/r/[slug]/route.ts
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "@/lib/firebase-admin";

/**
 * ── THE PARTNER LINK ────────────────────────────────────────────────
 * `adimfit.com/r/adura` counts the open, then redirects to the landing
 * page with `?ref=adura` so the existing attribution capture runs
 * unchanged.
 *
 * WHY A SERVER REDIRECT AND NOT JUST `?ref=`. A view is the only part
 * of a partner's funnel that happens before any of our JavaScript
 * runs. Without a server hop there is nothing to count — the client
 * `referral_link_clicked` event only fires for visitors who load the
 * page, keep JavaScript on, and aren't blocking PostHog, which is a
 * biased subset and not a number to pay anyone against.
 *
 * DEDUPED PER BROWSER PER DAY. Every messaging app fetches a link to
 * build its preview card: WhatsApp, LinkedIn, X and Slack each hit it
 * at least once per share, before a human has seen anything. Crawlers
 * do the same. Counting raw opens would hand a partner a number four
 * or five times their real reach, and the first thing they do with it
 * is compute a conversion rate — which then looks catastrophic. The
 * cookie makes the number mean roughly "people", which is the only
 * version a partner can reconcile against their own audience.
 *
 * It is still an approximation: one person on two devices counts
 * twice, and a preview fetch from a client that stores cookies counts
 * once. Label it "views", never "visitors".
 *
 * COUNTING NEVER BLOCKS THE REDIRECT. A Firestore failure, an unknown
 * slug, a paused partner — all of them still send the visitor to the
 * landing page. A broken counter must not become a broken link, or a
 * partner's whole campaign dies over an analytics write.
 * ─────────────────────────────────────────────────────────────────────
 */

const COOKIE_MAX_AGE = 60 * 60 * 36; // 36h — comfortably past a day boundary

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await params;
  const slug = raw.trim().toLowerCase();

  const url = new URL(request.url);
  const target = new URL("/", url.origin);

  // Forward every campaign parameter the partner appended, then set
  // `ref` from the path. The path wins: the link's own slug is what
  // the partner was given and is harder to get wrong than a query
  // string they may have edited.
  url.searchParams.forEach((value, key) => {
    if (key !== "ref") target.searchParams.set(key, value);
  });
  target.searchParams.set("ref", slug);

  const response = NextResponse.redirect(target, 302);

  // Bad slug shapes are redirected without a lookup — no reason to
  // touch Firestore for something that can never be a partner.
  if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(slug)) return response;

  const cookieName = `af_v_${slug}`;
  const today = todayKey();
  const seen = readCookie(request.headers.get("cookie"), cookieName);

  // Always refresh the cookie, even when already counted, so an active
  // visitor doesn't age back into being countable mid-session.
  response.cookies.set(cookieName, today, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
  });

  if (seen === today) return response;

  try {
    // Not awaited-and-checked beyond this: the visitor is already
    // being redirected and nothing about their experience depends on
    // the write landing.
    await getAdminDb()
      .doc(`partners/${slug}`)
      .update({ "counters.views": FieldValue.increment(1) });
  } catch {
    // Unknown slug (update on a missing document throws) or a
    // transient Firestore error. Either way the redirect stands.
  }

  return response;
}
