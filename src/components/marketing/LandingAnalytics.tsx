// src/components/marketing/LandingAnalytics.tsx
"use client";

import { useEffect } from "react";

import { readFirstTouch, setFirstTouch, track } from "@/lib/analytics";

/**
 * ── ATTRIBUTION, AS AN ISLAND ───────────────────────────────────────
 * Renders nothing. It exists so the landing page itself can be a
 * server component while attribution still runs in the browser, where
 * `window.location.search` and the PostHog client both live.
 *
 * Attribution is recorded ONCE per person. Overwriting it on a later
 * visit would credit whichever channel they happened to return
 * through, destroying the answer to "what brought them in".
 * ─────────────────────────────────────────────────────────────────────
 */
export function LandingAnalytics() {
  useEffect(() => {
    const touch = readFirstTouch();
    setFirstTouch(touch);

    track("landing_page_viewed", {
      hero_variant: touch.hero_variant ?? "default",
      utm_source: touch.utm_source,
      utm_medium: touch.utm_medium,
      utm_campaign: touch.utm_campaign,
      referral_code: touch.referral_code,
    });

    // Channel A's minimum viable test: a code in the URL plus a funnel
    // breakdown gives per-trainer signups without a trainer dashboard.
    if (touch.referral_code) {
      track("referral_link_clicked", { coach_slug: touch.referral_code });
    }
  }, []);

  return null;
}
