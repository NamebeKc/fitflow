// src/components/marketing/FaqSection.tsx
import { ChevronDown } from "lucide-react";

import {
  GUARANTEE_DAYS,
  PLANS,
  TRIAL_DAYS,
} from "@/lib/plan-catalogue";

/**
 * ── THE ANSWERS, IN THE HTML ────────────────────────────────────────
 * This section exists twice over: once as visible copy, and once as
 * `FAQPage` structured data in LandingPage. Both read from the array
 * below, so the schema can never claim something the page does not
 * say — which is the failure mode Google penalises and, worse, the
 * one that turns an assistant's citation into a misquote.
 *
 * WHY `<details>` AND NOT THE SHADCN ACCORDION. Radix renders
 * collapsed panels with `hidden`, and the entire purpose of this
 * section is to put answers where a crawler that does not execute
 * JavaScript can read them. `<details>` keeps every answer in the
 * document, needs no client bundle, and is keyboard-accessible and
 * screen-reader-correct without a single ARIA attribute. This is one
 * of the few places where the platform primitive beats the design
 * system, and the reason is indexability rather than taste.
 *
 * LENGTH IS DELIBERATE. Each answer is 40–60 words: long enough to
 * stand alone when an assistant lifts it out of context, short enough
 * that nothing is padded. Every figure is read from the plan
 * catalogue rather than typed here.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface Faq {
  question: string;
  answer: string;
}

export const FAQS: Faq[] = [
  {
    question: "What is AdimFit?",
    answer:
      "AdimFit is an AI fitness coach that builds every session from your own training history. You log what you did in seconds, then ask what to do next. It answers from the sessions you actually recorded, adapting when your week changes, rather than handing you a fixed template.",
  },
  {
    question: "How is AdimFit different from asking ChatGPT for a workout plan?",
    answer:
      "A general chatbot starts from zero every conversation. AdimFit keeps your logged sessions and reasons from them, so it knows you squatted 3 × 10 last week and rested yesterday. The difference is not the model underneath — it is that your coach remembers what you have already done.",
  },
  {
    question: "Do I need a gym or equipment to use AdimFit?",
    answer:
      "No. AdimFit works with a full gym, a pair of dumbbells, or nothing but your own bodyweight. You tell it what you have access to, and it never prescribes equipment you do not own. Change that answer when your circumstances change and the programming follows.",
  },
  {
    question: "Can my employer, gym or trainer see what I log?",
    answer:
      "No. Your training log is visible to you and to nobody else. No employer, gym or trainer can see what you logged, and AdimFit does not sell your data or share it with advertisers. Where an organisation sponsors accounts, it receives aggregate figures only — never an individual's activity.",
  },
  {
    question: "How much does AdimFit cost?",
    answer:
      `AdimFit is ${PLANS.monthly_usd.display} a month or ${PLANS.annual_usd_2026.display} a year — founding-cohort pricing, half the standard price. In Nigeria that is ${PLANS.monthly_ngn.display} monthly or ${PLANS.annual_ngn_2026.display} yearly. Every account starts with a ${TRIAL_DAYS}-day free trial and no card, and any charge is refundable for ${GUARANTEE_DAYS} days on request.`,
  },
  {
    question: "Does AdimFit need a smartwatch or fitness tracker?",
    answer:
      "No. AdimFit does not read from wearables or health apps. You enter sessions yourself, which takes seconds and means the log reflects what you actually did rather than what a sensor inferred. A phone is all you need, and it runs in the browser without installing anything.",
  },
];

export function FaqSection() {
  return (
    <section
      id="faq"
      className="border-t border-rule"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto w-full max-w-[1180px] px-6 py-16 md:px-8 md:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:gap-16">
          <div className="lg:sticky lg:top-12 lg:self-start">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-muted">
              Straight answers
            </p>
            <h2
              id="faq-heading"
              className="mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl"
            >
              Questions people
              <span className="text-ink-muted"> actually ask.</span>
            </h2>
          </div>

          <div className="divide-y divide-rule border-y border-rule">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group py-6">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 outline-none focus-visible:ring-2 focus-visible:ring-moss">
                  <h3 className="text-[16px] font-medium leading-snug text-ink">
                    {faq.question}
                  </h3>
                  <ChevronDown
                    className="mt-0.5 size-4 shrink-0 text-ink-faint transition-transform group-open:rotate-180"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                </summary>

                <p className="mt-3 max-w-prose pr-10 text-[15px] leading-relaxed text-ink-muted">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
