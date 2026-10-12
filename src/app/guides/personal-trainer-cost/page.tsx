// src/app/guides/personal-trainer-cost/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import {
  ArticleLayout,
  Bullets,
  Callout,
  DataTable,
  Em,
  H2,
  H3,
  P,
  Sources,
  Strong,
} from "@/components/content/ArticleLayout";
import { guide } from "@/content/guides";
import { PLANS } from "@/lib/plan-catalogue";
import { OG_IMAGE, absoluteUrl } from "@/lib/site";

const SLUG = "personal-trainer-cost";
const entry = guide(SLUG);

export const metadata: Metadata = {
  title: entry.title,
  description: entry.description,
  alternates: { canonical: `/guides/${SLUG}` },
  openGraph: {
    type: "article",
    title: entry.title,
    description: entry.description,
    url: absoluteUrl(`/guides/${SLUG}`),
    publishedTime: entry.published,
    modifiedTime: entry.modified,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    images: [OG_IMAGE.url],
  },
};

export default function Page() {
  return (
    <ArticleLayout slug={SLUG}>
      <H2 id="short-answer">The short answer</H2>
      <P>
        Most one-to-one sessions in the United States fall between{" "}
        <Strong>$50 and $90</Strong>. In the UK the range is wider — roughly
        £20 to £90 — with a median around <Strong>£70</Strong> and
        gym-based trainers typically charging £30 to £65 an hour.
      </P>
      <P>
        Those are per-session figures, which is how trainers quote and the
        least useful way to think about it. Nobody hires a trainer once.
      </P>

      <H2 id="united-states">United States</H2>
      <DataTable
        columns={["City", "Typical range", "Average"]}
        rows={[
          ["National", "$50–$90", "—"],
          ["New York City", "$100–$135", "$100"],
          ["Palm Beach, FL", "$90–$100", "$95"],
          ["San Diego, CA", "$76–$85", "$80"],
          ["Philadelphia, PA", "$70–$95", "$80"],
          ["Los Angeles, CA", "$65–$80", "$75"],
        ]}
        caption="Source 1, Bark marketplace data, per 60-minute one-to-one session. Retrieved September 2026. These are marketplace rates, not an independent survey — treat them as indicative of what trainers quote rather than a national average."
      />

      <H2 id="united-kingdom">United Kingdom</H2>
      <DataTable
        columns={["Region", "Per session"]}
        rows={[
          ["London", "£40–£90"],
          ["Edinburgh", "£30–£70"],
          ["Manchester", "£30–£70"],
          ["Glasgow", "£25–£60"],
          ["Bristol", "£25–£60"],
          ["Birmingham", "£20–£60"],
          ["Outside London", "£20–£40"],
          ["Group sessions", "£20–£30"],
        ]}
        caption="Source 2, Airtasker UK, last updated March 2025. Median one-to-one cost £70; gym-based trainers £30–£65 per hour."
      />

      <H2 id="nigeria">Nigeria</H2>
      <P>
        Here the honest answer is that reliable per-session data does not
        exist. Nigerian trainers overwhelmingly negotiate privately, rates
        are not published, and the figures that circulate online are
        anecdotes. Anyone presenting a confident national average is
        guessing.
      </P>
      <P>
        Gym membership is published, and it is a reasonable proxy for what
        the market bears:
      </P>
      <DataTable
        columns={["Location", "Budget", "Mid-range", "Premium"]}
        rows={[
          ["Lagos (Island)", "₦12k–₦25k", "₦25k–₦50k", "₦50k–₦150k+"],
          ["Lagos (Mainland)", "₦6k–₦15k", "₦15k–₦35k", "₦35k–₦80k+"],
          ["Abuja", "₦10k–₦20k", "₦20k–₦45k", "₦45k–₦100k+"],
          ["Port Harcourt", "₦7k–₦18k", "₦18k–₦40k", "₦40k–₦80k+"],
          ["Ibadan", "₦5k–₦12k", "₦12k–₦25k", "₦25k–₦50k+"],
        ]}
        caption="Source 3, GymSquare Nigeria, monthly membership, 2026. Personal training is normally charged on top of membership and negotiated per trainer."
      />

      <H2 id="per-year">What it costs per year</H2>
      <P>
        This is the number that matters, and almost nobody quotes it. Twice
        a week is <Em>104 sessions a year</Em>:
      </P>
      <DataTable
        columns={["Rate", "Per week", "Per year"]}
        rows={[
          ["$50 (US, low end)", "$100", "$5,200"],
          ["$70 (US, mid)", "$140", "$7,280"],
          ["$100 (New York)", "$200", "$10,400"],
          ["£45 (UK, gym-based)", "£90", "£4,680"],
          ["£70 (UK, median)", "£140", "£7,280"],
        ]}
        caption="Derived: 104 sessions per year at the stated rate. Arithmetic, not survey data."
      />
      <Callout>
        Even at the cheapest end of either market, twice a week for a year
        costs several thousand. That is not a criticism of trainers — it is
        simply what an hour of undivided professional attention costs when
        it has to be delivered in person, one person at a time.
      </Callout>

      <H2 id="what-youre-buying">What the money actually buys</H2>
      <P>
        Worth separating, because people often pay for all four and only
        needed one:
      </P>
      <Bullets
        items={[
          <>
            <Em>Programming.</Em> What to do, in what order, progressed over
            time. The most systematisable part, and the part software
            handles best.
          </>,
          <>
            <Em>Technique coaching.</Em> A trained eye on an unfamiliar
            lift, corrected in the moment. Genuinely hard to replace and the
            main reason a beginner should consider a few sessions.
          </>,
          <>
            <Em>Accountability.</Em> A booked appointment with a person
            expecting you. For many people this is the entire product, and
            they are paying trainer rates for it.
          </>,
          <>
            <Em>Adjustment.</Em> Someone noticing the shoulder is not right
            today and changing the session. Partly replaceable, partly not.
          </>,
        ]}
      />

      <H3>When a trainer is clearly worth it</H3>
      <P>
        Learning barbell lifts from scratch with nobody watching. Training
        around an injury or a medical condition. Preparing for something
        with specific technical demands. Or the honest case: you have tried
        the cheap options repeatedly and only a booked appointment gets you
        moving. That is worth paying for and there is no shame in it.
      </P>

      <H3>When it is mostly supervision you do not need</H3>
      <P>
        You already know the movements, you have trained consistently
        before, and what you actually lack is a plan and a record. That is a
        cheaper problem than it looks.
      </P>

      <H2 id="comparison">For scale</H2>
      <P>
        AdimFit is {PLANS.monthly_usd.display} a month or{" "}
        {PLANS.annual_usd_2026.display} a year, and{" "}
        {PLANS.monthly_ngn.display} or {PLANS.annual_ngn_2026.display} in
        Nigeria. At the US low end, <Strong>one session</Strong> costs about
        what a year costs here. In Lagos, one month of a mid-range Island
        gym is roughly a year of AdimFit.
      </P>
      <P>
        We are obviously not neutral about this. The comparison is also not
        like for like: an app does the programming and the record and none
        of the technique coaching.{" "}
        <Link
          href="/guides/personal-trainer-alternatives"
          className="text-ink underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-moss"
        >
          The alternatives compared
        </Link>{" "}
        goes through every option, including the ones we do not sell — and
        the one most people should probably pick is not an app.
      </P>

      <H2 id="sources">Sources</H2>
      <Sources
        items={[
          {
            name: "Bark — 2026 Personal Trainers Prices (US)",
            detail:
              "Marketplace pricing data. Rates quoted by trainers on the platform, not an independent survey.",
            url: "https://www.bark.com/en/us/personal-trainer/personal-trainer-cost/",
          },
          {
            name: "Airtasker UK — How Much Does a Personal Trainer Cost?",
            detail:
              "Industry and third-party rate research. Last updated 26 March 2025; methodology not published in detail.",
            url: "https://www.airtasker.com/uk/costs/personal-training/personal-trainer-cost/",
          },
          {
            name: "GymSquare Nigeria — Gym Membership in Nigeria 2026",
            detail:
              "Monthly membership tiers by city. Used as a proxy; it is not personal training pricing.",
            url: "https://gymsquare.ng/gym-membership-in-nigeria-2026/",
          },
        ]}
      />
      <P>
        Prices move. These were retrieved in September 2026 and the annual
        figures are arithmetic on top of them, so check the sources before
        quoting anything here back at a trainer.
      </P>
    </ArticleLayout>
  );
}
