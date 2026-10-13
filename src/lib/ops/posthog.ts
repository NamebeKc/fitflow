// src/lib/ops/posthog.ts

/**
 * ── POSTHOG, FOR THE HALF FIRESTORE CANNOT SEE ──────────────────────
 * Firestore holds state: who is subscribed, what they paid, what they
 * logged. It holds no behaviour — nobody's path from landing page to
 * first workout, no funnel, no drop-off. That lives in PostHog, and
 * one HogQL query gets all of it.
 *
 * TWO HOSTS, AND THEY ARE NOT THE SAME. `NEXT_PUBLIC_POSTHOG_HOST` is
 * the INGESTION host (`eu.i.posthog.com`) — it takes events and does
 * not serve the query API. Queries go to the app host
 * (`eu.posthog.com`). Pointing the API at the ingestion host returns
 * 404s that look like an auth problem and waste an afternoon, so the
 * `i.` is stripped when `POSTHOG_API_HOST` is not set explicitly.
 *
 * DEGRADES TO NULL, NEVER THROWS. The Firestore half of this
 * dashboard is the half that carries money, and it must render when
 * PostHog is misconfigured, rate-limited or simply down. A missing
 * key returns null and the page says so.
 *
 * The personal API key needs the **Query Read** scope and nothing
 * else. It is a different credential from `NEXT_PUBLIC_POSTHOG_KEY`,
 * which is the public ingestion key and cannot read anything.
 * ─────────────────────────────────────────────────────────────────────
 */

const TIMEOUT_MS = 20_000;

/** Events worth a daily line. Anything not listed is not charted. */
export const TRACKED_EVENTS = [
  "landing_page_viewed",
  "signup_completed",
  "onboarding_completed",
  "coach_first_message_sent",
  "coach_message_sent",
  "workout_first_logged",
  "workout_log_completed",
  "paywall_shown",
  "checkout_started",
  "trial_started",
  "trial_converted",
] as const;

export interface EventDay {
  day: string;
  event: string;
  count: number;
}

export interface SourceRow {
  code: string;
  signups: number;
}

export interface PostHogData {
  days: EventDay[];
  sources: SourceRow[];
}

function apiHost(): string | null {
  const explicit = process.env.POSTHOG_API_HOST?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const ingestion = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  if (!ingestion) return null;
  // eu.i.posthog.com -> eu.posthog.com
  return ingestion.replace(/\/+$/, "").replace("://i.", "://").replace(".i.", ".");
}

async function hogql<T>(sql: string, name: string): Promise<T[] | null> {
  const key = process.env.POSTHOG_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const host = apiHost();
  if (!key || !projectId || !host) return null;

  try {
    const response = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { kind: "HogQLQuery", query: sql },
        // Surfaces in PostHog's own query_log, so a slow dashboard can
        // be traced back to the thing that asked for it.
        name: `adimfit-ops:${name}`,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        "[ops/posthog] Query rejected:",
        name,
        response.status,
        await response.text().catch(() => ""),
      );
      return null;
    }

    const payload = (await response.json()) as { results?: unknown[] };
    return (payload.results ?? []) as T[];
  } catch (error) {
    console.error("[ops/posthog] Query failed:", name, error);
    return null;
  }
}

/**
 * Daily counts per event, and signups by referral code.
 *
 * One row per (day, event) rather than one series per event: it is a
 * single round trip, and a day with no events of a kind is simply
 * absent, which the caller fills with zero. A query per event would be
 * eleven round trips to say the same thing.
 */
export async function fetchPostHog(days: number): Promise<PostHogData | null> {
  const window = Math.max(1, Math.min(90, Math.floor(days)));
  const events = TRACKED_EVENTS.map((e) => `'${e}'`).join(", ");

  const [rows, sources] = await Promise.all([
    hogql<[string, string, number]>(
      `SELECT toString(toDate(timestamp)) AS day, event, count() AS n
       FROM events
       WHERE timestamp >= now() - INTERVAL ${window} DAY
         AND event IN (${events})
       GROUP BY day, event
       ORDER BY day ASC
       LIMIT 5000`,
      "daily-events",
    ),
    hogql<[string, number]>(
      `SELECT
         coalesce(nullIf(toString(person.properties.referral_code), ''), 'organic') AS code,
         count() AS n
       FROM events
       WHERE event = 'signup_completed'
         AND timestamp >= now() - INTERVAL ${window} DAY
       GROUP BY code
       ORDER BY n DESC
       LIMIT 20`,
      "signup-sources",
    ),
  ]);

  if (!rows && !sources) return null;

  return {
    days: (rows ?? []).map(([day, event, count]) => ({
      day,
      event,
      count: Number(count) || 0,
    })),
    sources: (sources ?? []).map(([code, signups]) => ({
      code,
      signups: Number(signups) || 0,
    })),
  };
}
