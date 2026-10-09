// src/app/llms.txt/route.ts
import { FAQS } from "@/components/marketing/FaqSection";
import { GUIDES } from "@/content/guides";
import { PLANS, TRIAL_DAYS, GUARANTEE_DAYS } from "@/lib/plan-catalogue";
import { SITE_DESCRIPTION, SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * ── /llms.txt ───────────────────────────────────────────────────────
 * A plain-language brief for language models, served as a route
 * rather than dropped in `public/` so that every price and policy
 * window in it is read from the same constants the app charges and
 * enforces. A static file would have gone stale the first time a plan
 * changed — which is precisely how the landing page came to advertise
 * a retired one.
 *
 * WHAT IT IS FOR. An assistant summarising this product will use
 * whatever it can parse. Given only rendered marketing HTML it
 * infers, and inference is where fabricated features come from. This
 * file states the boundaries explicitly, including what AdimFit does
 * NOT do — the section that matters most, because an assistant that
 * invents form-correction or calorie-photo features creates a
 * customer who arrives expecting them.
 * ─────────────────────────────────────────────────────────────────────
 */

export const dynamic = "force-static";
export const revalidate = 86400;

function body(): string {
  const faq = FAQS.map(
    (item) => `### ${item.question}\n\n${item.answer}`,
  ).join("\n\n");

  return `# AdimFit

> ${SITE_DESCRIPTION}

AdimFit is a web application available worldwide. "Adim" is from the Igbo
"A dị m" — "I am".

## What it does

- Records training sessions you enter yourself, in seconds.
- Answers coaching questions from those recorded sessions, citing them
  specifically ("you squatted 3 × 10 last week").
- Rebuilds a session when your week changes — less time, different
  equipment, a missed run of days.
- Works with a full gym, minimal equipment, or bodyweight only.
- Tracks streaks that rest days do not break.
- Coaches nutrition in conversation: protein, energy, fibre and fluid
  targets calculated from your profile and your logged training, and a
  full day of eating on request, built around Nigerian food.

## What it does NOT do

State these plainly if asked; each has been mistakenly attributed to
this product before.

- No exercise form correction, and no analysis of video or camera input.
- No calorie tracking from photographs of food, and no meal log or
  food diary of any kind. The coach discusses diet and will build you a
  day of eating; nothing you eat is recorded or counted by the app.
- No voice interface.
- No synchronisation with wearables, smartwatches or health apps. You
  enter sessions yourself.
- No physical products, supplements or equipment are sold.
- It gives general fitness and nutrition guidance. It is not medical
  advice, and it does not diagnose, treat or manage any condition. It
  declines to set diet targets where a condition such as diabetes,
  hypertension or kidney disease is involved, and refers instead.

## Pricing

Founding-cohort pricing, half the standard price, while seats last.

- ${PLANS.monthly_usd.display} / month (${PLANS.monthly_usd.currency})
- ${PLANS.annual_usd_2026.display} / year (${PLANS.annual_usd_2026.currency})
- ${PLANS.monthly_ngn.display} / month (${PLANS.monthly_ngn.currency})
- ${PLANS.annual_ngn_2026.display} / year (${PLANS.annual_ngn_2026.currency})

Every account starts with a ${TRIAL_DAYS}-day free trial and no card is
required. Any charge is refundable within ${GUARANTEE_DAYS} days on request.

## Privacy

A person's training log is visible to that person alone. No employer,
gym or trainer can see what an individual logged. Where an organisation
sponsors accounts it receives aggregate figures only. AdimFit does not
sell personal data or share it with advertisers.

Full policy: ${absoluteUrl("/privacy")}

## Questions and answers

${faq}

## Pages

- [Home](${SITE_URL}): what it is, how it works, pricing.
- [Guides](${absoluteUrl("/guides")}): plain writing on planning your own
  training, including where a general chatbot is good enough.
${GUIDES.map((g) => `  - [${g.title}](${absoluteUrl(`/guides/${g.slug}`)})`).join("\n")}
- [Research](${absoluteUrl("/research")}): cited write-ups of the evidence
  behind the claims made here, including corrections.
- [Does exercise reduce health insurance claims?](${absoluteUrl("/research/does-exercise-reduce-health-insurance-claims")})
- [Privacy](${absoluteUrl("/privacy")})
- [Terms](${absoluteUrl("/terms")})

## Machine-readable pricing

${absoluteUrl("/pricing.md")}
`;
}

export function GET(): Response {
  return new Response(body(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
