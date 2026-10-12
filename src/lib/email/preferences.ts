// src/lib/email/preferences.ts
import { createHmac, timingSafeEqual } from "node:crypto";

import { getAdminDb } from "@/lib/firebase-admin";
import { SITE_URL } from "@/lib/site";

/**
 * ── WHO MAY BE EMAILED, AND ABOUT WHAT ──────────────────────────────
 * Two classes of mail, and the difference is not a matter of taste.
 *
 * TRANSACTIONAL mail is the consequence of something the user did
 * with their own money: a receipt, a failed charge, a confirmation
 * that they cancelled. It always sends. There is no unsubscribe,
 * because "stop telling me what you charged me" is not a preference a
 * paid product can honour.
 *
 * LIFECYCLE mail is everything we send because we would like them to
 * come back: the weekly summary, the nudge after a quiet week, the
 * reminder that a trial is ending. Every one of these checks the
 * preference first and carries a one-click unsubscribe.
 *
 * The distinction is enforced by the type below rather than by
 * remembering — `isLifecycle` is what `canSend` keys off, so adding a
 * new kind forces a decision about which it is.
 * ─────────────────────────────────────────────────────────────────────
 */

export const EMAIL_KINDS = {
  // Transactional — always sent.
  receipt: { lifecycle: false, label: "Payment receipts" },
  payment_failed: { lifecycle: false, label: "Failed payments" },
  cancelled: { lifecycle: false, label: "Cancellation confirmations" },
  // Lifecycle — opt-out.
  trial_ending: { lifecycle: true, label: "Trial reminders" },
  trial_ended: { lifecycle: true, label: "Trial reminders" },
  weekly_summary: { lifecycle: true, label: "Weekly training summary" },
  lapsed: { lifecycle: true, label: "Nudges when you go quiet" },
} as const;

export type EmailKind = keyof typeof EMAIL_KINDS;

export function isLifecycle(kind: EmailKind): boolean {
  return EMAIL_KINDS[kind].lifecycle;
}

export interface EmailPreferences {
  /** Master switch for every lifecycle email. */
  lifecycle: boolean;
  updatedAt: string;
}

const DEFAULT: EmailPreferences = {
  // Opt-OUT, not opt-in, and worth being honest about why: these are
  // service messages to people with an account, not a newsletter to a
  // purchased list. The defensible version of that default is that
  // every one carries a working one-click unsubscribe, so it is kept
  // honest by the footer rather than by the checkbox.
  lifecycle: true,
  updatedAt: "",
};

function prefRef(uid: string) {
  return getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("settings")
    .doc("email");
}

/**
 * The stored preference, or the default if nothing has been stored.
 *
 * THROWS if Firestore cannot be read. Callers that are about to send
 * mail must not use this — see `loadPreferences`. It exists for the
 * settings UI, where a failed read has to surface as an error rather
 * than as a plausible-looking "off".
 */
export async function readPreferences(uid: string): Promise<EmailPreferences> {
  const snap = await prefRef(uid).get();
  if (!snap.exists) return DEFAULT;
  return { ...DEFAULT, ...(snap.data() as Partial<EmailPreferences>) };
}

/** The send path's read. Never throws; suppresses mail if it cannot tell. */
export async function loadPreferences(uid: string): Promise<EmailPreferences> {
  try {
    return await readPreferences(uid);
  } catch (error) {
    // A preferences read that fails must not cause a send. Failing
    // CLOSED is the only safe direction: the cost of a missed weekly
    // summary is nothing, the cost of mailing someone who opted out
    // is a spam complaint against a domain with no reputation.
    console.error("[email] Preference read failed, suppressing:", uid, error);
    return { ...DEFAULT, lifecycle: false };
  }
}

export async function setLifecycle(uid: string, on: boolean): Promise<void> {
  await prefRef(uid).set(
    { lifecycle: on, updatedAt: new Date().toISOString() },
    { merge: true },
  );
}

/** Transactional always passes. Lifecycle asks. */
export async function canSend(uid: string, kind: EmailKind): Promise<boolean> {
  if (!isLifecycle(kind)) return true;
  return (await loadPreferences(uid)).lifecycle;
}

/**
 * ── UNSUBSCRIBE LINKS ───────────────────────────────────────────────
 * Signed, not looked up.
 *
 * The link has to work with no session — it is clicked from a mail
 * client, often on a different device, sometimes years later, and
 * Gmail's one-click unsubscribe (RFC 8058) POSTs to it with no user
 * present at all. So it cannot require sign-in.
 *
 * That means the uid travels in the URL, which makes the signature
 * the only thing standing between a curious person and unsubscribing
 * somebody else. HMAC over the uid with a server-side secret: not
 * guessable, not forgeable, and verifiable without a database read.
 *
 * Deliberately NOT expiring. An unsubscribe link in a two-year-old
 * email must still work; that is the entire point of the header.
 */
function secret(): string {
  const value = process.env.EMAIL_UNSUB_SECRET;
  if (!value) {
    throw new Error("EMAIL_UNSUB_SECRET is not set");
  }
  return value;
}

export function unsubscribeToken(uid: string): string {
  return createHmac("sha256", secret()).update(uid).digest("base64url");
}

export function verifyUnsubscribeToken(uid: string, token: string): boolean {
  try {
    const expected = Buffer.from(unsubscribeToken(uid));
    const given = Buffer.from(token);
    // Length check first: timingSafeEqual throws on a mismatch, and
    // the throw would itself leak length through timing.
    if (expected.length !== given.length) return false;
    return timingSafeEqual(expected, given);
  } catch {
    return false;
  }
}

export function unsubscribeUrl(uid: string): string {
  return `${SITE_URL}/api/email/unsubscribe?u=${encodeURIComponent(
    uid,
  )}&t=${unsubscribeToken(uid)}`;
}
