// src/lib/attribution.ts
"use client";

import { setFirstTouch } from "@/lib/analytics";

/**
 * ── WHERE A SIGNUP CAME FROM ────────────────────────────────────────
 * Captured in the browser at first touch, claimed server-side once the
 * user has an account. Everything downstream of this file produces
 * money — a partner bounty is paid against the code recorded here — so
 * two properties matter more than convenience.
 *
 * FIRST TOUCH WINS, ALWAYS. A live record is never overwritten. If
 * someone arrives via Adura's link and later clicks Bimpe's, Adura
 * keeps the attribution. Last-touch would let any partner steal
 * another's referral by getting the final click, and there is no way
 * to arbitrate that after the fact.
 *
 * THE BROWSER IS NOT TRUSTED. This writes to localStorage, which the
 * user controls completely. The server re-validates the code against
 * an active partner before storing it, and re-checks the window at
 * conversion. Anything here is a claim, not a fact.
 *
 * It also mirrors into PostHog person properties, so the acquisition
 * funnel and the payment ledger agree without a second capture point.
 * ─────────────────────────────────────────────────────────────────────
 */

const KEY = "adimfit.attribution";

/** Server re-reads the real window from the partner's terms. */
const DEFAULT_WINDOW_DAYS = 60;
const DAY_MS = 86_400_000;

export interface Attribution {
  referralCode: string | null;
  cohort: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  heroVariant: string | null;
  firstTouchAt: string;
  expiresAt: string;
}

function safeRead(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Attribution;
    if (!parsed?.firstTouchAt || !parsed?.expiresAt) return null;

    // An expired record is cleared rather than returned, so a stale
    // code can't be claimed months later by a returning visitor.
    if (new Date(parsed.expiresAt).getTime() < Date.now()) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    // Private mode, disabled storage, or corrupt JSON. Attribution
    // degrades to none — which loses a bounty, never invents one.
    return null;
  }
}

function clean(value: string | null): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/**
 * Reads campaign parameters from the current URL and records them if
 * nothing is stored yet. Safe to call on every page load.
 */
export function captureAttribution(
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Attribution | null {
  if (typeof window === "undefined") return null;

  const existing = safeRead();
  if (existing) return existing;

  const params = new URLSearchParams(window.location.search);
  const referralCode = clean(params.get("ref"));
  const utmSource = clean(params.get("utm_source"));

  // No campaign parameters means an organic visit. Storing an empty
  // record would block a later referred visit from ever attributing.
  if (!referralCode && !utmSource) return null;

  const now = new Date();
  const record: Attribution = {
    referralCode,
    cohort: clean(params.get("cohort")),
    utmSource,
    utmMedium: clean(params.get("utm_medium")),
    utmCampaign: clean(params.get("utm_campaign")),
    heroVariant: clean(params.get("v")),
    firstTouchAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + windowDays * DAY_MS).toISOString(),
  };

  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable. The claim below still runs for this
    // session; it just won't survive a reload.
  }

  // Same facts, PostHog's copy. `$set_once` there mirrors the
  // first-touch rule here, so the two never disagree.
  setFirstTouch({
    hero_variant: record.heroVariant ?? undefined,
    utm_source: record.utmSource ?? undefined,
    utm_medium: record.utmMedium ?? undefined,
    utm_campaign: record.utmCampaign ?? undefined,
    referral_code: record.referralCode ?? undefined,
  });

  return record;
}

export function getAttribution(): Attribution | null {
  return safeRead();
}

/**
 * Hands the stored record to the server for a signed-in user.
 *
 * Idempotent by design — the route writes once per user and ignores
 * every later call — so this can run on any sign-in without guarding.
 * Failures are swallowed: a missing bounty is a smaller problem than a
 * sign-in that errors because an attribution POST timed out.
 */
export async function claimAttribution(idToken: string): Promise<void> {
  const record = safeRead();
  if (!record) return;

  try {
    await fetch("/api/attribution/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(record),
    });
  } catch (error) {
    console.error("[attribution] Claim failed:", error);
  }
}
