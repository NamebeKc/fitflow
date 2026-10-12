// src/lib/email/mailer.ts
import nodemailer, { type Transporter } from "nodemailer";

import { getAdminDb } from "@/lib/firebase-admin";

/**
 * ── SENDING MAIL ────────────────────────────────────────────────────
 * One narrow interface, one transport behind it.
 *
 * WHY THE INTERFACE EXISTS. We send through the Hostinger mailbox
 * because it is already paid for and 1,000 messages a day per mailbox
 * is far beyond what ~50 users need. What it does not give us is
 * bounce and complaint webhooks, per-message analytics, or a sending
 * domain we control separately from the apex. The day any of those
 * starts to matter — realistically the first time a retention send
 * goes out to more than a few hundred people — this moves to a real
 * ESP. `Mailer` is the seam that makes that a config change and a new
 * ~40-line transport, rather than a rewrite of every call site.
 *
 * PORT 25 IS BLOCKED ON GOOGLE CLOUD. Ports 587 and 465 are
 * documented as unrestricted, but that documentation covers Compute
 * Engine and says nothing about Cloud Run. Treat outbound SMTP from
 * the deployed service as UNPROVEN until a real send succeeds from a
 * deployed revision — see the dry-run switch below, which exists so
 * that an unreachable SMTP host degrades to a logged no-op instead of
 * throwing inside a billing webhook.
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
}

export interface SendResult {
  sent: boolean;
  skipped?: "no-transport" | "dry-run";
  messageId?: string;
  error?: string;
}

export interface Mailer {
  send(email: Email): Promise<SendResult>;
}

/**
 * A hard ceiling per invocation.
 *
 * Hostinger allows 1,000 a day per mailbox on Business Starter, and
 * the whole allowance can be spent by one loop that doesn't terminate.
 * This is not a rate limit; it is a blast radius.
 */
export const MAX_SENDS_PER_RUN = 120;

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

export const mailer: Mailer = new SmtpMailer();

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

  const result = await mailer.send(build());

  await ref
    .set(
      {
        sent: result.sent,
        skipped: result.skipped ?? null,
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
