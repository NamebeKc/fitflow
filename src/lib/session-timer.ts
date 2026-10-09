// src/lib/session-timer.ts

/**
 * ── SESSION STOPWATCH STATE ─────────────────────────────────────────
 * Elapsed time for a whole training session, and the handoff of that
 * duration into the log form.
 *
 * WHY LOCALSTORAGE AND NOT REACT STATE. A session lasts 45 minutes and
 * the phone is in a pocket for most of it. The PWA will be backgrounded,
 * very likely evicted, and quite possibly reloaded before the user comes
 * back to stop the clock. React state does not survive any of that; a
 * start timestamp on disk survives all three.
 *
 * WHY A TIMESTAMP AND NOT AN ELAPSED COUNTER. Same reason `RestTimer`
 * derives from a target time: mobile browsers throttle timers hard in
 * backgrounded tabs, so anything that accumulates on an interval
 * silently runs slow. Reading the wall clock each tick cannot drift.
 *
 * WHY THE HANDOFF EXISTS AT ALL. Manual logging is permanent
 * architecture here (see `workouts.ts`), which makes the cost of
 * logging the product's main structural risk. A timer that knows the
 * session ran 47 minutes and then makes the user type "47" has wasted
 * the one thing it knew.
 * ─────────────────────────────────────────────────────────────────────
 */

const START_KEY = "adimfit:session-started-at";
const PENDING_KEY = "adimfit:pending-duration-min";

/**
 * Sessions longer than this are treated as an abandoned timer rather
 * than a very long workout — someone started the clock, walked away,
 * and came back the next day. Twelve hours is generous enough that no
 * real session is ever discarded.
 */
const MAX_SESSION_MS = 12 * 60 * 60 * 1000;

/* ══ Storage helpers ══════════════════════════════════════════════ */

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private mode, blocked site data, or a thumbnail capture.
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Non-fatal: the timer still works for this page's lifetime.
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing useful to do.
  }
}

/* ══ Session clock ════════════════════════════════════════════════ */

/**
 * Epoch ms the running session began, or null when idle.
 *
 * Self-healing: a stored start that is impossible (unparseable, in the
 * future, or older than `MAX_SESSION_MS`) is cleared rather than
 * returned, so a stale key can never show someone a 14-hour workout.
 */
export function readSessionStart(): number | null {
  const raw = read(START_KEY);
  if (!raw) return null;

  const startedAt = Number(raw);
  if (!Number.isFinite(startedAt)) {
    remove(START_KEY);
    return null;
  }

  const elapsed = Date.now() - startedAt;
  if (elapsed < 0 || elapsed > MAX_SESSION_MS) {
    remove(START_KEY);
    return null;
  }

  return startedAt;
}

export function startSession(): number {
  const now = Date.now();
  write(START_KEY, String(now));
  return now;
}

export function clearSession(): void {
  remove(START_KEY);
}

/* ══ Handoff to the log form ══════════════════════════════════════ */

/**
 * Rounds elapsed milliseconds to whole minutes the way a person would.
 *
 * Minimum one: a 40-second session is not zero minutes, and offering
 * "0" to the log form would read as a bug.
 */
export function elapsedToMinutes(elapsedMs: number): number {
  return Math.max(1, Math.round(elapsedMs / 60_000));
}

export function stashDuration(minutes: number): void {
  write(PENDING_KEY, String(minutes));
}

/**
 * Reads the stashed duration and clears it in the same call.
 *
 * Read-once on purpose: the value is a one-time handoff, so leaving it
 * behind would silently prefill the next workout someone logs a week
 * later.
 */
export function takePendingDuration(): number | null {
  const raw = read(PENDING_KEY);
  if (!raw) return null;
  remove(PENDING_KEY);

  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.round(minutes);
}

/* ══ Formatting ═══════════════════════════════════════════════════ */

/** `M:SS` under an hour, `H:MM:SS` beyond it. */
export function formatElapsed(elapsedMs: number): string {
  const total = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const ss = String(seconds).padStart(2, "0");

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** `TUE 25 SEP` — the date stamp asked for alongside the clock. */
export function sessionDateLabel(date: Date = new Date()): string {
  return date
    .toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    })
    .toUpperCase();
}
