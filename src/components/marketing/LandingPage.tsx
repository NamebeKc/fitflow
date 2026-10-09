// src/components/marketing/LandingPage.tsx
import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { PLANS, TRIAL_DAYS } from "@/lib/plan-catalogue";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";
import { HEADLINES, type HeadlineKey } from "@/components/marketing/headlines";
import { HeroVideo } from "@/components/marketing/HeroVideo";
import { FeatureSection } from "@/components/marketing/FeatureSection";
import { ConversionCard } from "@/components/marketing/ConversionCard";
import { LandingAnalytics } from "@/components/marketing/LandingAnalytics";
import { FAQS, FaqSection } from "@/components/marketing/FaqSection";
import { socialProfileUrls } from "@/lib/social";
import { SocialLinks } from "@/components/marketing/SocialLinks";

/**
 * ── THE FRONT DOOR ──────────────────────────────────────────────────
 * Four principles, the fourth learned most expensively:
 *
 * 1. SHOW THE PRODUCT, NOT A FANTASY OF IT. The hero demonstrates the
 *    one thing AdimFit does that a generic chatbot cannot: answer
 *    from your own logged history.
 *
 * 2. FASTEST PATH FIRST. Google sign-in is one tap; email is three
 *    fields typed on a phone. Google leads, email is available.
 *
 * 3. COPY STATES THE BENEFIT. Not the vibe.
 *
 * 4. IT HAS TO BE IN THE HTML. This page was a client component that
 *    resolved its headline inside `useEffect` and animated its copy in
 *    with Framer Motion. The consequence: `curl https://adimfit.com`
 *    returned a logo and the word "Initializing". Every crawler, and
 *    every AI retrieval bot — none of which execute JavaScript — saw
 *    a site with no content on it. No amount of copywriting or
 *    keyword work survives that, so it was fixed first.
 *
 *    This component is now a SERVER component. The variant arrives as
 *    a prop, already resolved from `?v=` on the server. The three
 *    genuinely interactive pieces — the auth card, attribution, and
 *    the hero video — are client islands, and nothing else ships
 *    JavaScript.
 *
 * WHAT THE STRUCTURED DATA IS FOR. The `@graph` below is not
 * decoration. An assistant asked "how much does AdimFit cost" reads
 * the `Offer` nodes; one asked "what is AdimFit" reads the
 * `SoftwareApplication`. Every value in it is derived from the plan
 * catalogue or from `FAQS`, never retyped — schema that disagrees
 * with the visible page is worse than no schema at all.
 * ─────────────────────────────────────────────────────────────────────
 */

export function LandingPage({ variant = "default" }: { variant?: HeadlineKey }) {
  const headline = HEADLINES[variant];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#090A0C] text-white antialiased">
      <StructuredData />
      <LandingAnalytics />

      <div className="relative">
        {/* ── Hero ────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Sits behind everything in this band. The poster is the LCP
              element; the video only loads when motion, data, and
              connection all allow it. */}
          <HeroVideo />

          <div className="relative">
            <NavBar />
          </div>

          <div className="relative mx-auto w-full max-w-[1180px] px-5 pb-16 pt-6 md:px-8 md:pb-24 md:pt-10">
            <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-16">
              <div>
                <div className="rise">
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#CCFF00]">
                    {headline.eyebrow}
                  </p>

                  <h1 className="mt-6 text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[3.25rem] lg:text-[3.6rem]">
                    {headline.title}{" "}
                    <span className="text-[#CCFF00]">{headline.emphasis}</span>
                  </h1>

                  <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/70">
                    {headline.subtitle}
                  </p>
                </div>

                <div className="rise delay-120 mt-9">
                  <ConversionCard />
                </div>
              </div>

              <div className="rise delay-260 lg:pt-4">
                <MemoryProof />
              </div>
            </div>
          </div>
        </section>

        <FeatureSection />
        <WhyDifferent />
        <WhyNotChatGpt />
        <PricingBand />
        <FaqSection />
        <Footer />
      </div>
    </div>
  );
}

/* ══ Structured data ══════════════════════════════════════════════ */

function StructuredData() {
  const offer = (planId: keyof typeof PLANS) => {
    const plan = PLANS[planId];
    return {
      "@type": "Offer",
      name: `${plan.label} — ${plan.currency}`,
      price: plan.amount.toString(),
      priceCurrency: plan.currency,
      url: absoluteUrl("/#pricing"),
      availability: "https://schema.org/InStock",
    };
  };

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: absoluteUrl("/logo-horizontal.png"),
        description:
          "AdimFit builds personalised training from a person's own logged sessions. Available worldwide as a web app.",
        // The profiles and this site are one entity. For a domain with
        // no search history, this is one of the few entity signals
        // available, and it is what lets a knowledge graph connect the
        // brand rather than treat the name as a loose string.
        sameAs: socialProfileUrls(),
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${SITE_URL}/#software`,
        name: SITE_NAME,
        applicationCategory: "HealthApplication",
        applicationSubCategory: "Fitness",
        operatingSystem: "Web browser, iOS, Android",
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}/#organization` },
        description: SITE_DESCRIPTION,
        featureList: [
          "Adaptive training plans built from your own logged sessions",
          "Conversational coaching that cites your training history",
          "Works with a gym, minimal equipment, or bodyweight only",
          "Rest days do not break your streak",
        ],
        offers: [
          offer("monthly_usd"),
          offer("annual_usd_2026"),
          offer("monthly_ngn"),
          offer("annual_ngn_2026"),
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: FAQS.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Server-rendered from constants in this repository — no user
      // input reaches this string.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

/* ══ Navigation ═══════════════════════════════════════════════════ */

function NavBar() {
  return (
    <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 md:px-8">
      <Image
        src="/logo-horizontal.png"
        alt="AdimFit"
        width={1646}
        height={430}
        priority
        className="h-10 w-auto sm:h-12"
      />

      <nav className="flex items-center gap-2 sm:gap-4">
        {/* Guides, not Research. The research reviews answer an
            insurer's question and open by conceding that wellness
            programmes do not reliably cut claims — true, and the wrong
            thing to put one click from "Sign in" for someone who came
            looking for a coach. They stay in the footer. */}
        <Link
          href="/guides"
          className="hidden text-[13px] text-white/60 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 sm:block"
        >
          Guides
        </Link>
        <a
          href="#auth"
          className="rounded-full border border-white/12 px-4 py-2 text-[13px] font-medium text-white/70 outline-none transition-colors hover:border-[#CCFF00]/40 hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
        >
          Sign in
        </a>
      </nav>
    </header>
  );
}

/* ══ The proof — what makes this different ════════════════════════ */

/**
 * A coach answering from the user's own log.
 *
 * This is the entire pitch in one image: the chips are real entries,
 * the reply cites them by name. Anyone who has asked a general chatbot
 * for a workout plan recognises immediately what's missing there.
 */
function MemoryProof() {
  return (
    <div className="rounded-3xl border border-white/[0.09] bg-[#14161A] p-5 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] sm:p-6">
      <div className="step delay-350">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          Your last few sessions
        </p>
        <div className="mt-3 space-y-2">
          <LogRow day="Tue" activity="Walk" detail="32 min" />
          <LogRow day="Wed" activity="Push-ups & squats" detail="18 min" />
          <LogRow day="Thu" activity="Rest day" detail="—" muted />
        </div>
      </div>

      <div className="my-5 h-px bg-white/[0.07]" />

      <div className="space-y-3.5">
        <div className="step delay-600 flex justify-end">
          <p className="max-w-[80%] rounded-2xl rounded-br-md bg-[#CCFF00] px-4 py-2.5 text-[15px] font-medium leading-relaxed text-black">
            What should I do today?
          </p>
        </div>

        <div className="step delay-900 flex justify-start">
          <div className="max-w-[94%] rounded-2xl rounded-bl-md border border-white/[0.09] bg-[#1F2228] px-4 py-3.5 text-[15px] leading-relaxed text-white/80">
            <p>
              You walked Tuesday and did push-ups Wednesday, then rested
              yesterday — so your legs are fresh.
            </p>
            <p className="mt-2.5">
              25 minutes lower body. Squats{" "}
              <span className="font-mono text-[#CCFF00]">3 × 12</span>, up from
              your 3 × 10 last week.
            </p>
          </div>
        </div>
      </div>

      <p className="step delay-1150 mt-5 border-t border-white/[0.07] pt-4 text-center text-[13px] leading-relaxed text-white/50">
        A general chatbot starts from zero every time.
        <br />
        <span className="text-white/70">AdimFit doesn&apos;t.</span>
      </p>
    </div>
  );
}

function LogRow({
  day,
  activity,
  detail,
  muted = false,
}: {
  day: string;
  activity: string;
  detail: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/30 px-3.5 py-2.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/50">
        {day}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[14px]",
          muted ? "text-white/50" : "text-white/80",
        )}
      >
        {activity}
      </span>
      <span className="font-mono text-[12px] tabular-nums text-white/50">
        {detail}
      </span>
    </div>
  );
}

/* ══ How it works ═════════════════════════════════════════════════ */

function WhyDifferent() {
  const points = [
    "Adapts when you only have 20 minutes",
    "Works with a gym, dumbbells, or nothing at all",
    "Never prescribes kit you don't own",
    "Rest days don't break your streak",
  ];

  return (
    <section className="mx-auto w-full max-w-[1180px] px-5 py-16 md:px-8 md:py-20">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">
            Built for real weeks
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl">
            Life gets in the way.
            <span className="text-white/50"> Your plan shouldn&apos;t break.</span>
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/60">
            Most plans assume an ideal week that never happens. Tell your
            coach you&apos;re in a hotel with 20 minutes and it rebuilds the
            session — without losing your progress.
          </p>
        </div>

        <ul className="space-y-3">
          {points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 rounded-2xl border border-white/[0.09] bg-[#14161A] px-4 py-3.5"
            >
              <Check
                className="mt-0.5 size-4 shrink-0 text-[#CCFF00]"
                strokeWidth={3}
              />
              <span className="text-[15px] leading-relaxed text-white/70">
                {point}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ══ The comparison people actually run ═══════════════════════════ */

/**
 * "Why not just use ChatGPT for this?" is the single most common
 * objection and the single most common thing typed into an assistant
 * about this category. Answering it in plain server-rendered prose is
 * worth more than any keyword: it is the passage most likely to be
 * retrieved and quoted.
 *
 * It is written as a comparison of MECHANISMS rather than a claim of
 * superiority, because the honest answer is narrow and specific —
 * memory of your own sessions — and a narrow true claim survives
 * scrutiny where a broad one invites it.
 */
function WhyNotChatGpt() {
  const rows = [
    {
      question: "Where the plan comes from",
      chatbot: "What you can describe in the prompt",
      adimfit: "Every session you have logged",
    },
    {
      question: "Next week's session",
      chatbot: "Starts from zero unless you paste your history again",
      adimfit: "Built from last week's actual numbers",
    },
    {
      question: "When you miss three days",
      chatbot: "The plan is unchanged; you are behind it",
      adimfit: "The plan changes; you are not behind anything",
    },
    {
      question: "Recording what you did",
      chatbot: "Nowhere, or a spreadsheet you maintain",
      adimfit: "In the app, in seconds, and reused",
    },
  ];

  return (
    <section
      id="why-not-chatgpt"
      className="border-t border-white/[0.07]"
      aria-labelledby="compare-heading"
    >
      <div className="mx-auto w-full max-w-[1180px] px-5 py-16 md:px-8 md:py-20">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">
            The obvious question
          </p>
          <h2
            id="compare-heading"
            className="mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl"
          >
            Why not just ask a chatbot
            <span className="text-white/50"> for a workout plan?</span>
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            You can, and for one session it works. The difference shows up in
            week three. A general chatbot has no record of what you did, so
            every conversation starts from whatever you can be bothered to
            retype. Programming that cannot see last week cannot build on it.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border border-white/[0.09]">
          <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-px bg-white/[0.07]">
            <div className="bg-[#0D0F13] px-4 py-3.5 sm:px-6" />
            <div className="bg-[#0D0F13] px-4 py-3.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50 sm:px-6">
              General chatbot
            </div>
            <div className="bg-[#0D0F13] px-4 py-3.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#CCFF00] sm:px-6">
              AdimFit
            </div>

            {rows.map((row) => (
              <Fragment key={row.question}>
                <div className="bg-[#14161A] px-4 py-4 text-[13px] font-medium leading-snug text-white/80 sm:px-6 sm:text-[14px]">
                  {row.question}
                </div>
                <div className="bg-[#14161A] px-4 py-4 text-[13px] leading-relaxed text-white/50 sm:px-6 sm:text-[14px]">
                  {row.chatbot}
                </div>
                <div className="bg-[#14161A] px-4 py-4 text-[13px] leading-relaxed text-white/80 sm:px-6 sm:text-[14px]">
                  {row.adimfit}
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══ Pricing ══════════════════════════════════════════════════════ */

/**
 * EVERY NUMBER HERE IS READ FROM THE PLAN CATALOGUE.
 *
 * It used to be typed by hand, and by the time anyone looked it was
 * advertising $59.99/year at "save 37%" — a plan marked `retired` in
 * the catalogue months earlier, at a discount that no longer matched
 * anything. A price shown on a public page and a price charged at
 * checkout have to come from one place, and this is that place.
 */
function PricingBand() {
  const monthly = PLANS.monthly_usd;
  const annual = PLANS.annual_usd_2026;

  return (
    <section id="pricing" className="border-t border-white/[0.07]">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-16 md:px-8 md:py-20">
        <div className="overflow-hidden rounded-3xl border border-[#CCFF00]/20 bg-gradient-to-b from-[#CCFF00]/[0.07] to-transparent">
          <div className="flex flex-col gap-8 p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-md">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#CCFF00]">
                Simple pricing
              </p>
              <h2 className="mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl">
                One plan. Cancel anytime.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-white/60">
                A single hour with a personal trainer costs more than a year
                of AdimFit. In Nigeria that is{" "}
                <span className="text-white/80">
                  {PLANS.monthly_ngn.display}
                </span>{" "}
                a month or{" "}
                <span className="text-white/80">
                  {PLANS.annual_ngn_2026.display}
                </span>{" "}
                a year.
              </p>
            </div>

            <div className="shrink-0">
              <p className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-[-0.04em]">
                  {monthly.display}
                </span>
                <span className="text-[15px] text-white/50">/ month</span>
              </p>
              <p className="mt-1.5 font-mono text-[12px] text-[#CCFF00]">
                or {annual.display} / year
                {annual.saving ? ` — ${annual.saving.toLowerCase()}` : ""}
              </p>

              <a
                href="#auth"
                className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-7 py-3.5 text-[15px] font-semibold text-black shadow-[0_10px_40px_-10px_rgba(204,255,0,0.5)] outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 active:scale-[0.99]"
              >
                Start free
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </a>

              <p className="mt-3 text-center text-[12px] text-white/50">
                {TRIAL_DAYS}-day free trial · No card required
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══ Footer ═══════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="border-t border-white/[0.07]">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-5 py-10 md:flex-row md:items-start md:justify-between md:px-8">
        <div className="space-y-5">
          <Image
            src="/logo-horizontal.png"
            alt="AdimFit"
            width={1646}
            height={430}
            className="h-9 w-auto opacity-90"
          />
          <p className="max-w-xs text-[12px] leading-relaxed text-white/50">
            <span className="text-white/70">A dị m</span> — Igbo for
            &ldquo;I am&rdquo;. Fitness as something you become, not
            something you attempt.
          </p>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <Link
              href="/guides"
              className="text-[13px] text-white/50 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
            >
              Guides
            </Link>
            <Link
              href="/research"
              className="text-[13px] text-white/50 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
            >
              Research
            </Link>
            <Link
              href="/privacy"
              className="text-[13px] text-white/50 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-[13px] text-white/50 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
            >
              Terms
            </Link>
          </nav>

          <SocialLinks className="-ml-2.5" />
        </div>

        <p className="max-w-md text-[12px] leading-relaxed text-white/50">
          AdimFit provides general fitness guidance and is not a substitute for
          medical advice. Consult a healthcare professional before starting a
          new exercise programme, particularly with an existing injury or
          medical condition.
        </p>
      </div>
    </footer>
  );
}
