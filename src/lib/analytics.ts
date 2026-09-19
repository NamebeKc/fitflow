// src/lib/analytics.ts
import posthog from "posthog-js";

/**
 * ── ANALYTICS ───────────────────────────────────────────────────────
 * Event names follow `object_verb_past-tense`, snake_case, matching the
 * funnel architecture document so PostHog funnels can be built from it
 * directly rather than translated.
 *
 * Two rules that shape everything here:
 *
 * 1. NOTHING PERSONAL IS SENT. No names, emails, message content, or
 *    workout notes. Properties are counts, categories, and booleans —
 *    enough to answer product questions, not enough to reconstruct a
 *    person.
 *
 * 2. ANALYTICS NEVER BREAKS THE PRODUCT. Every call is wrapped; a
 *    blocked script or bad key degrades to nothing.
 *
 * Anything that GATES ACCESS — payment success, churn, entitlement —
 * is emitted server-side from `analytics-server.ts`. Client capture of
 * those would undercount behind ad blockers and be trivially spoofable.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Every event the client can emit. Adding one here is the only way. */
export type AnalyticsEvent =
  // ── Acquisition ──────────────────────────────────────────────────
  | "landing_page_viewed"
  | "auth_mode_switched"
  | "signup_started"
  | "signup_completed"
  | "signin_completed"
  | "password_reset_requested"
  // ── Onboarding ───────────────────────────────────────────────────
  | "onboarding_step_viewed"
  | "onboarding_step_completed"
  | "onboarding_skipped_setup"
  | "onboarding_completed"
  // ── Coach ────────────────────────────────────────────────────────
  | "coach_first_message_sent"
  | "coach_message_sent"
  | "coach_quick_action_used"
  | "plan_prescribed"
  | "plan_logged_one_tap"
  | "exercise_video_opened"
  | "conversation_cleared"
  | "rest_timer_started"
  | "screen_wake_lock_toggled"
  // ── Logging ──────────────────────────────────────────────────────
  | "workout_log_started"
  | "workout_log_completed"
  | "workout_log_deleted"
  | "workout_first_logged"
  | "workout_shared"
  | "share_dialog_opened"
  // ── Habit & retention ────────────────────────────────────────────
  | "streak_week_reached"
  | "dashboard_viewed"
  | "tab_guide_dismissed"
  | "tab_guide_used"
  | "progress_viewed"
  | "weigh_in_opened"
  | "measurement_logged"
  | "profile_edited"
  | "account_deleted"
  // ── PWA ──────────────────────────────────────────────────────────
  | "pwa_install_prompt_shown"
  | "pwa_installed"
  | "pwa_install_dismissed"
  // ── Monetization (client half — see analytics-server for the rest) ─
  | "paywall_shown"
  | "paywall_step_viewed"
  | "checkout_started"
  | "checkout_abandoned"
  // ── Referral, Phase 4 (Channel A test) ───────────────────────────
  | "referral_link_clicked"
  // ── Reminders ────────────────────────────────────────────────────
  | "reminder_prompt_shown"
  | "reminder_prompt_dismissed"
  | "push_permission_requested"
  | "push_permission_granted"
  | "push_permission_denied"
  | "reminders_disabled"
  // ── Not yet built — declared so funnels can be pre-built ─────────
  | "reminder_opened"
  | "weekly_summary_viewed"
  | "strava_connect_started"
  | "strava_connected";

type EventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

let ready = false;

export function analyticsReady(): boolean {
  return ready;
}

export function initAnalytics(): void {
  if (ready) return;
  if (typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return;

  // Session replay is OFF unless explicitly enabled. Recording screens
  // by default sits badly beside a privacy policy promising restraint —
  // turn it on to answer a specific question about onboarding or
  // paywall friction, not as a standing default.
  const replay = process.env.NEXT_PUBLIC_POSTHOG_REPLAY === "true";

  try {
    posthog.init(key, {
      api_host: host,
      capture_pageview: false, // manual, for App Router navigation
      capture_pageleave: true,
      disable_session_recording: !replay,
      autocapture: false,
      persistence: "localStorage+cookie",
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "[data-private]",
      },
    });
    ready = true;
  } catch (error) {
    console.error("[analytics] init failed:", error);
  }
}

export function track(
  event: AnalyticsEvent,
  properties?: EventProperties,
): void {
  if (!ready) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // Never let telemetry break a user action.
  }
}

export function trackPageView(path: string): void {
  if (!ready) return;
  try {
    posthog.capture("$pageview", { $current_url: path });
  } catch {
    // Non-fatal.
  }
}

/**
 * Links events to a stable user.
 *
 * Firebase UID and nothing else — no email, no name. Enough to measure
 * retention and funnels per person without putting identifying data in
 * a third-party system.
 */
export function identifyUser(uid: string): void {
  if (!ready) return;
  try {
    posthog.identify(uid);
  } catch {
    // Non-fatal.
  }
}

export function resetAnalytics(): void {
  if (!ready) return;
  try {
    posthog.reset();
  } catch {
    // Non-fatal.
  }
}

/* ══ First-touch attribution ══════════════════════════════════════ */

export interface FirstTouch {
  hero_variant?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referral_code?: string;
}

/** Reads campaign parameters from the current URL. */
export function readFirstTouch(): FirstTouch {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);

  const pick = (key: string) => params.get(key) ?? undefined;

  return {
    hero_variant: pick("v") ?? "default",
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    // `?ref=coachbetty` — the Channel A referral test needs no more
    // than this plus a funnel breakdown.
    referral_code: pick("ref"),
  };
}

/**
 * Records campaign attribution so it survives the session.
 *
 * `$set_once` rather than `$set`: a person's FIRST touch is what
 * attribution means. Overwriting it on a later visit would credit the
 * last channel and quietly destroy the answer to "what actually
 * brought this customer in".
 */
export function setFirstTouch(touch: FirstTouch): void {
  if (!ready) return;
  const defined = Object.fromEntries(
    Object.entries(touch).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(defined).length === 0) return;

  try {
    posthog.setPersonPropertiesForFlags?.(defined);
    posthog.capture("$set", { $set_once: defined });
  } catch {
    // Non-fatal.
  }
}