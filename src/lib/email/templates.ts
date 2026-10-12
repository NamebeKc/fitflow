// src/lib/email/templates.ts
import type { Email } from "@/lib/email/mailer";
import { unsubscribeUrl } from "@/lib/email/preferences";
import { SITE_URL } from "@/lib/site";

/**
 * ── THE MESSAGES ────────────────────────────────────────────────────
 * Text first, every time. The HTML twin is generated from it by
 * `wrap()`, so if the plain-text version doesn't read well on its own
 * the email is wrong — not the template.
 *
 * House rules, which are the same ones the coach follows: no
 * exclamation marks, no emoji, no "Hi there 👋", no manufactured
 * urgency. These go to people who are paying, or deciding whether to.
 * ─────────────────────────────────────────────────────────────────────
 */

interface Person {
  uid: string;
  email: string;
  firstName?: string;
}

const hi = (p: Person) => (p.firstName ? `${p.firstName},` : "Hello,");
const SIGN_OFF = "— Chi\nAdimFit";

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Transactional ───────────────────────────────────────────────────

export function receipt(
  p: Person,
  o: { planLabel: string; amount: string; periodEnd?: string; txRef: string },
): Email {
  return {
    to: p.email,
    subject: `Your AdimFit receipt — ${o.amount}`,
    text: `${hi(p)}

Thanks — your payment went through.

Plan: ${o.planLabel}
Amount: ${o.amount}
Reference: ${o.txRef}${
      o.periodEnd ? `\nRenews: ${formatDate(o.periodEnd)}` : ""
    }

You can cancel any time from the Profile tab, and keep access to the end of the period you've paid for. If anything about this charge looks wrong, reply to this email and I'll sort it.

${SITE_URL}

${SIGN_OFF}`,
  };
}

export function paymentFailed(
  p: Person,
  o: { planLabel: string; graceEnds?: string },
): Email {
  return {
    to: p.email,
    subject: "Your AdimFit payment didn't go through",
    text: `${hi(p)}

The card on your ${o.planLabel} plan was declined, so this month's payment hasn't gone through.

Nothing has changed yet${
      o.graceEnds ? ` — you keep access until ${formatDate(o.graceEnds)}` : ""
    }. Nigerian cards often decline on the first try for reasons that have nothing to do with your balance, so it's usually worth simply trying again.

Update your card: ${SITE_URL}/profile

If it keeps failing, reply here and tell me what the bank said. I'd rather fix it than lose you to a card problem.

${SIGN_OFF}`,
  };
}

export function cancelled(p: Person, o: { accessUntil?: string }): Email {
  return {
    to: p.email,
    subject: "Your AdimFit subscription is cancelled",
    text: `${hi(p)}

Confirming it's done. Nothing further will be charged.

${
  o.accessUntil
    ? `You keep full access until ${formatDate(o.accessUntil)}.`
    : "Your access continues to the end of the period you've paid for."
}

Your training log stays exactly where it is. If you come back, the coach picks up from your last session rather than starting you over.

If you've a minute, I'd genuinely like to know what didn't work. Just reply — it goes to me.

${SIGN_OFF}`,
  };
}

// ── Lifecycle ───────────────────────────────────────────────────────

export function trialEnding(
  p: Person,
  o: { daysLeft: number; sessions: number; endsAt?: string },
): Email {
  const trained =
    o.sessions > 0
      ? `You've logged ${o.sessions} session${o.sessions === 1 ? "" : "s"} so far. The coach programmes from those — that history is the thing that makes it different from a generic plan, and it's what carries on if you subscribe.`
      : `You haven't logged a session yet. If something got in the way, reply and tell me what — that's more useful to me than a polite goodbye.`;

  return {
    to: p.email,
    subject:
      o.daysLeft <= 1
        ? "Your AdimFit trial ends tomorrow"
        : `${o.daysLeft} days left on your AdimFit trial`,
    text: `${hi(p)}

Your free trial ends ${
      o.endsAt ? `on ${formatDate(o.endsAt)}` : `in ${o.daysLeft} days`
    }. There's no card on file, so nothing will be charged and nothing will happen automatically — access just stops.

${trained}

Keep going: ${SITE_URL}/profile

${SIGN_OFF}`,
    unsubscribeUrl: unsubscribeUrl(p.uid),
  };
}

export function trialEnded(p: Person, o: { sessions: number }): Email {
  return {
    to: p.email,
    subject: "Your AdimFit trial has ended",
    text: `${hi(p)}

That's your seven days up. No card was taken and nothing has been charged.

${
  o.sessions > 0
    ? `Your ${o.sessions} logged session${o.sessions === 1 ? " is" : "s are"} still there. Subscribe and the coach carries on from where you left off.`
    : `Everything's still there if you want to pick it up.`
}

${SITE_URL}/profile

If you decided it wasn't for you, that's genuinely fine — but I'd like to know why. One line is plenty.

${SIGN_OFF}`,
    unsubscribeUrl: unsubscribeUrl(p.uid),
  };
}

export function weeklySummary(
  p: Person,
  o: {
    sessions: number;
    minutes: number;
    streakWeeks?: number;
    lastTitle?: string;
  },
): Email {
  const body =
    o.sessions === 0
      ? `Nothing logged this week. No lecture — weeks happen. The quickest way back in is one short session today, logged.`
      : `${o.sessions} session${o.sessions === 1 ? "" : "s"}, ${o.minutes} minutes.${
          o.streakWeeks && o.streakWeeks >= 2
            ? ` That's ${o.streakWeeks} weeks running.`
            : ""
        }${o.lastTitle ? `\n\nLast one: ${o.lastTitle}.` : ""}`;

  return {
    to: p.email,
    subject:
      o.sessions === 0 ? "Your week on AdimFit" : `Your week: ${o.sessions} logged`,
    text: `${hi(p)}

${body}

Ask the coach what to do next: ${SITE_URL}/coach

${SIGN_OFF}`,
    unsubscribeUrl: unsubscribeUrl(p.uid),
  };
}

export function lapsed(p: Person, o: { daysQuiet: number }): Email {
  return {
    to: p.email,
    subject: "Still here when you want it",
    text: `${hi(p)}

It's been ${o.daysQuiet} days since your last logged session. Not a telling-off — I'd just rather check in than let it drift.

If you've been training and not logging, that's worth knowing too: reply and say so, and I'll stop sending these.

If you want back in, ask the coach for something short. It still has everything you logged before.

${SITE_URL}/coach

${SIGN_OFF}`,
    unsubscribeUrl: unsubscribeUrl(p.uid),
  };
}
