// src/lib/email/mailer.ts
import nodemailer, { type Transporter } from "nodemailer";

import { getAdminDb } from "@/lib/firebase-admin";

/**
 * ── SENDING MAIL ────────────────────────────────────────────────────
 * One narrow interface, two transports behind it, chosen by env.
 *
 * RESEND IS THE DEFAULT, over HTTPS. The deciding factor was not
 * features, it was provability: port 25 is blocked on Google Cloud,
 * and while 587 and 465 are documented as unrestricted, that
 * documentation covers Compute Engine and says nothing about Cloud
 * Run. Outbound SMTP from a deployed revision was a thing we could
 * only find out by trying. An HTTPS POST to api.resend.com is a thing
 * Cloud Run demonstrably does. That removed the only unknown standing
 * between this system and a deploy.
 *
 * It also buys what shared SMTP cannot: bounce and complaint
 * webhooks, per-message delivery state, and a verified sending
 * subdomain whose reputation is isolated from the apex that carries
 * Firebase auth mail and the support mailbox. Resend's SPF and MX
 * records live on a `send.` return-path subdomain, so the apex SPF
 * record — and its 10-lookup budget, runbook §8.1.1 — is untouched.
 * DMARC still aligns: DKIM strictly, SPF under relaxed alignment
 * since both sit under adimfit.com.
 *
 * THE SMTP TRANSPORT STAYS. Not as dead weight — as the thing that
 * keeps the seam honest. Set EMAIL_PROVIDER=smtp and the Hostinger
 * mailbox takes over with no other change, which is the whole claim
 * this interface was built to make. It is also the fallback if a
 * Resend key is ever revoked mid-month.
 *
 * EVERY FAILURE DEGRADES TO A LOGGED NO-OP. A missing key, a missing
 * MAIL_FROM, an unreachable provider: all return `sent: false` rather
 * than throwing. A mail problem must never turn a successful payment
 * into a 500.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface Email {
  to: string;
  subject: string;
  /** The real message. Written first, and on its own it must read well. */
  text: string;
  /** Optional light wrapper. See `wrap()` for why it stays light. */
  html?: string;
  /** Adds List-Unsubscribe headers. Omit for transactional mail. */
  unsubscribeUrl?: string;
  replyTo?: string;
  /**
   * Provider-side duplicate protection, independent of our own claim.
   *
   * Resend honours an `Idempotency-Key` header for 24 hours: a second
   * request with the same key returns the first response without
   * sending again. Its own documentation suggests the shape
   * `<event-type>/<entity-id>`, which is what `sendOnce` already
   * computes — so the Firestore claim and the provider agree on what
   * "the same message" means, and a crash between the two no longer
   * has a window in which a duplicate can escape.
   *
   * Set by `sendOnce`. Ignored by the SMTP transport.
   */
  idempotencyKey?: string;
  /** Provider-side labels, for per-kind delivery stats. */
  tags?: Record<string, string>;
}

export interface SendResult {
  sent: boolean;
  skipped?: "no-transport" | "no-from" | "dry-run";
  messageId?: string;
  error?: string;
}

export interface Mailer {
  send(email: Email): Promise<SendResult>;
}

/**
 * A hard ceiling per invocation. Not a rate limit — a blast radius.
 *
 * The number matters more than it looks, because the binding
 * constraint is DAILY and the Monday weekly-summary burst is a single
 * run. Resend's free tier allows 3,000 a month but only 100 a DAY;
 * Pro ($20/mo) removes the daily cap entirely. Hostinger allows 1,000
 * a day per mailbox. So 90 is deliberately under the tightest of
 * those, and `EMAIL_MAX_PER_RUN` raises it once the plan does.
 *
 * At ~50 users a Monday run is ~50 sends and none of this bites. It
 * bites at roughly 100 subscribers, on a Monday, silently, by
 * truncating the run — which is why the dispatcher returns
 * `budgetLeft` and why that number is worth watching.
 */
export const MAX_SENDS_PER_RUN = (() => {
  const raw = Number(process.env.EMAIL_MAX_PER_RUN);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 90;
})();

let cached: Transporter | null = null;

function transport(): Transporter | null {
  if (cached) return cached;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host,
    port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS. Getting this
    // backwards produces a hang rather than an error, which is the
    // worst failure mode available, so it is derived rather than set.
    secure: port === 465,
    auth: { user, pass },
    // Cloud Run gives a request ~a few seconds of patience. A mail
    // server that is not answering must fail fast and be logged, not
    // hold a billing webhook open until it times out.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return cached;
}

/**
 * Light HTML, deliberately.
 *
 * adimfit.com has no sending reputation (deployment runbook §8.2), and
 * a brand-new domain whose first messages are image-heavy multi-column
 * HTML is a textbook spam signal. A short text/plain body with a
 * minimal HTML twin delivers better and reads fine in every client.
 * Design it later, once the domain has a history.
 */
export function wrap(text: string, unsubscribeUrl?: string): string {
  const body = text
    .trim()
    .split("\n\n")
    .map(
      (para) =>
        `<p style="margin:0 0 16px;line-height:1.6">${para
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/\n/g, "<br>")}</p>`,
    )
    .join("");

  const footer = unsubscribeUrl
    ? `<p style="margin:24px 0 0;font-size:13px;color:#76716A">
         <a href="${unsubscribeUrl}" style="color:#485B0F">Unsubscribe from these emails</a>
       </p>`
    : "";

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
      font-size:16px;color:#1F1914;background:#FAF7F3;padding:24px">
      <div style="max-width:540px;margin:0 auto">${body}${footer}</div>
    </div>`;
}

class SmtpMailer implements Mailer {
  async send(email: Email): Promise<SendResult> {
    const t = transport();
    if (!t) {
      // Not an error. A deployment without SMTP credentials should run
      // normally and simply not send — a missing env var must never
      // turn a successful payment into a 500.
      console.warn("[email] No SMTP transport configured; skipping send");
      return { sent: false, skipped: "no-transport" };
    }

    if (process.env.EMAIL_DRY_RUN === "true") {
      console.info("[email] DRY RUN →", email.to, "|", email.subject);
      return { sent: false, skipped: "dry-run" };
    }

    const from = process.env.MAIL_FROM ?? "AdimFit <support@adimfit.com>";

    try {
      const info = await t.sendMail({
        from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html ?? wrap(email.text, email.unsubscribeUrl),
        replyTo: email.replyTo ?? process.env.MAIL_REPLY_TO ?? undefined,
        headers: email.unsubscribeUrl
          ? {
              // RFC 8058. Gmail and Yahoo both weight this now, and a
              // bulk sender without it gets filtered regardless of SPF.
              "List-Unsubscribe": `<${email.unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            }
          : undefined,
      });
      return { sent: true, messageId: info.messageId };
    } catch (error) {
      console.error("[email] Send failed:", email.to, email.subject, error);
      return { sent: false, error: String(error) };
    }
  }
}

/**
 * ── RESEND, OVER HTTPS ──────────────────────────────────────────────
 * Plain `fetch`, no SDK. The REST surface we need is one POST, and a
 * dependency whose only job is to rename `reply_to` to `replyTo` is
 * not worth a supply-chain entry.
 *
 * THE REST API IS snake_case. `reply_to`, not `replyTo` — the Node
 * SDK camel-cases them and the REST endpoint does not, which is the
 * one thing that silently drops a field if you guess.
 *
 * RATE LIMITS ARE REAL AND SHARED. Ten requests per second per TEAM,
 * across every API key, with no burst allowance. The dispatcher does
 * Firestore reads between sends so it rarely gets close, but "rarely"
 * is not a guarantee and a 429 that isn't retried is a dropped email.
 * One retry, paced by the server's own `retry-after`, is enough:
 * retrying with the same idempotency key cannot double-send.
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 15_000;
/** A cap on how long we'll honour a server's retry-after. */
const MAX_BACKOFF_MS = 6_000;

/** Resend tag names and values accept only ASCII letters, digits, _ and -. */
function tagSafe(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class ResendMailer implements Mailer {
  async send(email: Email): Promise<SendResult> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[email] RESEND_API_KEY is not set; skipping send");
      return { sent: false, skipped: "no-transport" };
    }

    // No default. A guessed From address on a domain Resend hasn't
    // verified fails every send with a 403, and a default would make
    // that look like a provider outage rather than a missing env var.
    const from = process.env.MAIL_FROM;
    if (!from) {
      console.warn("[email] MAIL_FROM is not set; skipping send");
      return { sent: false, skipped: "no-from" };
    }

    if (process.env.EMAIL_DRY_RUN === "true") {
      console.info("[email] DRY RUN →", email.to, "|", email.subject);
      return { sent: false, skipped: "dry-run" };
    }

    const replyTo = email.replyTo ?? process.env.MAIL_REPLY_TO;
    const body: Record<string, unknown> = {
      from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html ?? wrap(email.text, email.unsubscribeUrl),
    };
    if (replyTo) body.reply_to = replyTo;
    if (email.unsubscribeUrl) {
      body.headers = {
        // RFC 8058. Gmail and Yahoo both weight this now, and a bulk
        // sender without it gets filtered regardless of SPF.
        "List-Unsubscribe": `<${email.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };
    }
    if (email.tags) {
      body.tags = Object.entries(email.tags).map(([name, value]) => ({
        name: tagSafe(name),
        value: tagSafe(value),
      }));
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    // 1–256 characters, or the request is rejected outright.
    if (email.idempotencyKey) {
      headers["Idempotency-Key"] = email.idempotencyKey.slice(0, 256);
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(RESEND_ENDPOINT, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
        });
      } catch (error) {
        // Timeout or network failure. The send may or may not have
        // landed, which is precisely what the idempotency key is for:
        // the retry is free of consequence either way.
        if (attempt === 0) {
          await sleep(1_000);
          continue;
        }
        console.error("[email] Resend unreachable:", email.to, error);
        return { sent: false, error: String(error) };
      }

      if (response.ok) {
        const payload = (await response
          .json()
          .catch(() => ({}))) as { id?: string };
        return { sent: true, messageId: payload.id };
      }

      const detail = await response.text().catch(() => "");

      // 429: shared, team-wide, and the server tells us how long to
      // wait. 5xx: the provider's problem, worth exactly one retry.
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt === 0) {
        const after = Number(response.headers.get("retry-after"));
        const wait = Number.isFinite(after) && after > 0 ? after * 1_000 : 1_000;
        await sleep(Math.min(wait, MAX_BACKOFF_MS));
        continue;
      }

      // 409 `concurrent_idempotent_requests` means an identical send is
      // already in flight somewhere — an overlapping invocation, not a
      // fault. Not sent by us, and nothing to alarm about.
      if (response.status === 409) {
        console.warn("[email] Resend idempotency conflict:", email.to, detail);
        return { sent: false, error: `409 ${detail}` };
      }

      console.error(
        "[email] Resend rejected:",
        response.status,
        email.to,
        email.subject,
        detail,
      );
      return { sent: false, error: `${response.status} ${detail}` };
    }

    return { sent: false, error: "Exhausted retries" };
  }
}

/**
 * The transport, chosen once.
 *
 * EMAIL_PROVIDER is explicit when set. Unset, a Resend key decides it,
 * so a deployment that has credentials for exactly one provider does
 * the obvious thing rather than needing a second variable to agree
 * with the first.
 *
 * Resolved lazily, on the first send. Reading env at module scope
 * would bind the choice to whenever Next.js happened to evaluate this
 * file, which during a build is before any runtime env exists.
 */
function selectMailer(): Mailer {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (provider === "smtp") return new SmtpMailer();
  if (provider === "resend") return new ResendMailer();
  return process.env.RESEND_API_KEY ? new ResendMailer() : new SmtpMailer();
}

let selected: Mailer | null = null;

export const mailer: Mailer = {
  send(email: Email): Promise<SendResult> {
    if (!selected) selected = selectMailer();
    return selected.send(email);
  },
};

/**
 * Send once, ever, for a given (user, kind, period).
 *
 * THE POINT OF THIS FUNCTION. Every scheduled job in this codebase can
 * run twice: Cloud Scheduler retries on a non-2xx, a deploy can
 * overlap an in-flight invocation, and a manual trigger during
 * debugging is indistinguishable from a real one. Without a claim, a
 * retry re-sends every email in the batch — and the second copy of
 * "your trial ends in 2 days" is how a product teaches people to
 * filter it.
 *
 * `create()` is the whole mechanism: it fails if the document already
 * exists, so the claim and the check are one atomic operation with no
 * read-then-write race. The claim is written BEFORE the send, so the
 * failure mode of a crash mid-send is a missing email rather than a
 * duplicate one. That is the right way round.
 *
 * `key` scopes the claim. For a weekly digest it is the ISO week; for
 * a trial warning it is the trial's end date; for a receipt it is the
 * transaction reference. Anything that identifies the one occasion
 * this message is allowed to exist.
 */
export async function sendOnce(
  uid: string,
  kind: string,
  key: string,
  build: () => Email,
): Promise<SendResult & { claimed: boolean }> {
  const id = `${uid}__${kind}__${key}`.replace(/\//g, "_");
  const ref = getAdminDb().collection("emailLog").doc(id);

  try {
    await ref.create({
      uid,
      kind,
      key,
      claimedAt: new Date().toISOString(),
    });
  } catch {
    // Already claimed. Not an error, and not worth a log line at the
    // volume this runs at — it is the expected result of a retry.
    return { sent: false, claimed: false };
  }

  // The claim id doubles as the provider's idempotency key, so the
  // two layers agree on what "the same message" is. Belt and braces,
  // and the braces are free.
  const result = await mailer.send({
    ...build(),
    idempotencyKey: id,
    tags: { kind },
  });

  if (result.skipped) {
    // NOTHING WAS SENT, so the claim must not stand. A dry run exists
    // to exercise every path without touching an inbox; if it kept
    // its claims, the first real run would skip exactly the people the
    // dry run covered and that mail would never go out. Same for a
    // deployment missing its API key. Releasing is safe precisely
    // because no message exists to duplicate.
    await ref.delete().catch((error) => {
      console.error("[email] Could not release claim:", id, error);
    });
    return { ...result, claimed: true };
  }

  await ref
    .set(
      {
        sent: result.sent,
        skipped: null,
        error: result.error ?? null,
        completedAt: new Date().toISOString(),
      },
      { merge: true },
    )
    .catch((error) => {
      // The mail is already gone; losing the receipt is a reporting
      // problem, not a sending one.
      console.error("[email] Could not finalise log:", id, error);
    });

  return { ...result, claimed: true };
}
