// src/app/api/geo/route.ts
import { NextResponse } from "next/server";

/**
 * Best-effort country detection, used only to pick a default currency.
 *
 * A caveat worth stating plainly: plain Cloud Run does NOT add
 * geolocation headers. They appear when traffic arrives through a
 * Google Cloud Load Balancer, Firebase Hosting, or Cloudflare — so on
 * a direct Cloud Run deployment this will usually return null, and the
 * client's timezone fallback does the real work.
 *
 * It's still worth having: if you later put a CDN or load balancer in
 * front (likely, for caching), detection improves with no code change.
 *
 * This NEVER decides what someone is charged. It picks which toggle
 * starts selected. Being wrong costs one tap.
 */

const NGN_COUNTRIES = new Set(["NG"]);

export async function GET(request: Request) {
  const headers = request.headers;

  // Different edges use different header names; check the common ones.
  const country =
    headers.get("x-vercel-ip-country") ??
    headers.get("cf-ipcountry") ??
    headers.get("x-appengine-country") ??
    headers.get("x-client-region") ??
    parseGeoLocation(headers.get("x-client-geo-location"));

  const normalized =
    country && country !== "XX" && country.length === 2
      ? country.toUpperCase()
      : null;

  return NextResponse.json(
    {
      country: normalized,
      currency: normalized && NGN_COUNTRIES.has(normalized) ? "NGN" : null,
    },
    {
      // Per-user and cheap to recompute — never cache this.
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/** GCLB sends "US,California,Mountain View" style values. */
function parseGeoLocation(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first && first.length === 2 ? first : null;
}