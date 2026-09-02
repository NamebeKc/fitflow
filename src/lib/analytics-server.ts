// src/lib/analytics-server.ts
import { PostHog } from "posthog-node";

/**
 * ── SERVER-SIDE ANALYTICS ───────────────────────────────────────────
 * For events that GATE ACCESS or represent money.
 *
 * Two reasons these cannot be client events:
 *
 * 1. UNDERCOUNTING. Ad blockers stop `posthog-js` for a meaningful
 *    share of users. Losing 20% of pageviews is annoying; losing 20%
 *    of conversions makes the number that decides your pricing model
 *    wrong.
 *
 * 2. SPOOFING. A browser can fire `trial_converted` without paying.
 *    The same reasoning that puts entitlement checks on the server
 *    puts revenue events there.
 *
 * Renewals also arrive by webhook with no browser involved at all, so
 * client capture couldn't see them regardless.
 * ─────────────────────────────────────────────────────────────────────
 */

export type ServerAnalyticsEvent =
  | "trial_started"
  | "trial_converted"
  | "trial_canceled"
  | "subscription_activated"
  | "subscription_renewed"
  | "subscription_payment_failed"
  | "subscription_payment_recovered"
  | "subscription_churned"
  | "entitlement_denied";

let client: PostHog | null = null;

/**
 * Lazily creates the client.
 *
 * `flushAt: 1` and `flushInterval: 0` mean every event is sent
 * immediately rather than batched. Batching is the right default for a
 * long-lived server, but route handlers on Cloud Run can be frozen or
 * torn down the moment a response is returned — a batched event would
 * simply be lost.
 */
function getClient(): PostHog | null {
  if (client) return client;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!key || !host) return null;

  try {
    client = new PostHog(key, {
      host,
      flushAt: 1,
      flushInterval: 0,
    });
    return client;
  } catch (error) {
    console.error("[analytics-server] init failed:", error);
    return null;
  }
}

/** How long we will wait for a flush before giving up on the event. */
const FLUSH_TIMEOUT_MS = 2000;

/**
 * Records a server-side event against a user.
 *
 * `distinctId` must be the Firebase UID — the same identifier
 * `identifyUser` sends from the browser — or the person's client and
 * server events land on two separate profiles and no funnel spanning
 * both will ever complete.
 *
 * THE FLUSH IS BOUNDED. An earlier version awaited it unconditionally,
 * which put a third-party network call directly in the path of the
 * chat request — if PostHog was slow or unreachable, the coach hung
 * until the browser gave up, and the user saw "Failed to fetch".
 *
 * Analytics is never worth a broken feature. The event is still
 * flushed promptly in the normal case (Cloud Run can freeze an
 * instance the moment a response returns, so fire-and-forget alone
 * would lose events), but a stalled flush is abandoned after two
 * seconds rather than holding the request open.
 */
export async function trackServer(
  distinctId: string,
  event: ServerAnalyticsEvent,
  properties?: Record<string, string | number | boolean | null | undefined>,
): Promise<void> {
  const posthog = getClient();
  if (!posthog) return;

  try {
    posthog.capture({ distinctId, event, properties });

    await Promise.race([
      posthog.flush(),
      new Promise((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS)),
    ]);
  } catch (error) {
    // Telemetry must never fail a request path.
    console.error("[analytics-server] capture failed:", event, error);
  }
}