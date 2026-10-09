// src/app/research/does-exercise-reduce-health-insurance-claims/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import {
  ARTICLE,
  CITATIONS,
  CORRECTION,
  QUESTIONS,
} from "@/content/research/exercise-and-claims";
import { OG_IMAGE, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: ARTICLE.title,
  description: ARTICLE.description,
  alternates: { canonical: `/research/${ARTICLE.slug}` },
  openGraph: {
    type: "article",
    title: ARTICLE.title,
    description: ARTICLE.description,
    url: absoluteUrl(`/research/${ARTICLE.slug}`),
    publishedTime: ARTICLE.published,
    modifiedTime: ARTICLE.modified,
    images: [OG_IMAGE],
  },
};

const ARTICLE_URL = absoluteUrl(`/research/${ARTICLE.slug}`);

export default function ResearchArticlePage() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ScholarlyArticle",
        "@id": `${ARTICLE_URL}#article`,
        headline: ARTICLE.title,
        description: ARTICLE.description,
        url: ARTICLE_URL,
        datePublished: ARTICLE.published,
        dateModified: ARTICLE.modified,
        inLanguage: "en",
        isAccessibleForFree: true,
        author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        publisher: { "@id": `${SITE_URL}/#organization` },
        mainEntityOfPage: ARTICLE_URL,
        // The citation array is what makes this page useful to a
        // retrieval system: it can resolve every claim to a paper
        // without parsing prose.
        citation: CITATIONS.map((source) => ({
          "@type": "ScholarlyArticle",
          name: source.title,
          author: source.authors,
          datePublished: String(source.year),
          isPartOf: source.publication,
          identifier: source.identifier,
          url: source.url,
        })),
      },
      {
        "@type": "FAQPage",
        "@id": `${ARTICLE_URL}#faq`,
        mainEntity: QUESTIONS.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <div className="min-h-dvh bg-paper text-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />

      <header className="border-b border-rule">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 md:px-8">
          <Link href="/" className="outline-none focus-visible:ring-2 focus-visible:ring-indigo/50">
            <Image
              src="/logo-horizontal.png"
              alt="AdimFit"
              width={1646}
              height={430}
              className="h-9 w-auto"
            />
          </Link>
          <Link
            href="/research"
            className="text-[13px] text-ink-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-indigo/50"
          >
            All research
          </Link>
        </div>
      </header>

      <article className="mx-auto w-full max-w-[720px] px-5 py-14 md:px-8 md:py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo">
          Evidence review
        </p>
        <h1 className="mt-5 text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[2.6rem]">
          {ARTICLE.title}
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-muted">
          {ARTICLE.subtitle}
        </p>

        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
          <time dateTime={ARTICLE.published}>21 September 2026</time>
          <span className="px-2 text-ink-faint">·</span>
          {ARTICLE.readingMinutes} min read
          <span className="px-2 text-ink-faint">·</span>
          {CITATIONS.length} sources
        </p>

        {/* ── Disclosure ──────────────────────────────────────────── */}
        <aside className="mt-10 rounded-md border border-indigo/25 bg-indigo/[0.05] p-5 sm:p-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-indigo">
            Commercial interest, declared
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
            AdimFit sells a fitness coaching app. We have an obvious
            interest in the conclusion that exercise programmes save
            insurers money. The honest answer is more equivocal than that,
            and this page says so — including the two randomised trials
            that found no effect on medical spending. Read the sources
            rather than taking our summary of them.
          </p>
        </aside>

        <Prose>
          <H2 id="short-answer">The short answer</H2>
          <P>
            Physical activity reduces disease risk. That is not seriously
            disputed. Whether a <Em>programme</Em> that encourages physical
            activity reduces an insurer&apos;s claims is a different
            question with a much weaker answer, and the gap between those
            two statements is where most of the wellness industry&apos;s
            marketing lives.
          </P>
          <P>
            The randomised evidence on workplace wellness found no effect
            on medical spending. The insurer data that does show lower
            admissions shows it only among highly engaged members, and only
            after two to three years. What an insurer is buying is not a
            benefit to offer; it is sustained, verified activity among
            members who were previously inactive. Very little of the
            available evidence demonstrates that an app alone produces
            that.
          </P>

          <H2 id="trials">What the randomised trials found</H2>
          <P>
            Two large randomised trials of workplace wellness programmes
            report the same uncomfortable result.
          </P>
          <P>
            The <Em>Illinois Workplace Wellness Study</Em> found no
            significant causal effect on total medical spending, biometric
            markers, diagnoses or utilisation. Its confidence intervals
            were tight enough to rule out 84% of previously published
            estimates of savings. It also found that participants had lower
            spending and healthier behaviours <Em>before</Em> the programme
            began — which is the single most important sentence in this
            literature, because it explains why so many non-randomised
            studies report savings. <Cite id="jones-2019" />
          </P>
          <P>
            The <Em>BJ&apos;s Wholesale trial</Em>, randomised across 160
            worksites over 18 months, raised self-reported regular exercise
            by 8.3 percentage points and active weight management by 13.6.
            It changed nothing measurable in BMI, blood pressure,
            cholesterol, absenteeism, healthcare use or spending.{" "}
            <Cite id="song-2019" />
          </P>
          <Callout>
            Self-reported exercise rose while clinical markers did not.
            Anyone designing a programme on self-logged activity — AdimFit
            included — has to sit with that finding rather than around it.
          </Callout>

          <H2 id="physiology">What exercise does to the risk factors</H2>
          <P>
            The physiological evidence is much stronger than the programme
            evidence, and it is worth separating the two rather than
            letting the first borrow credibility for the second.
          </P>
          <P>
            Across 93 randomised trials, endurance training lowered blood
            pressure by 3.5/2.5 mmHg overall and by 8.3/5.2 mmHg in
            hypertensive adults. Isometric resistance training produced
            10.9/6.2 mmHg. <Cite id="cornelissen-2013" />
          </P>
          <P>
            On steps, benefit accrues fastest at the bottom of the range
            and levels off around 7,000 a day. Against a 2,000-step
            baseline, 7,000 steps was associated with 47% lower all-cause
            mortality, 25% lower cardiovascular disease, 14% lower type 2
            diabetes, 22% lower depression and 28% fewer falls — with the
            authors flagging low certainty for several of those outcomes.{" "}
            <Cite id="lancet-2025" /> An earlier meta-analysis of 15 cohorts
            put the mortality plateau at 6,000–8,000 steps for adults over
            60 and 8,000–10,000 for those under 60. <Cite id="paluch-2022" />
          </P>

          <H2 id="cost">What inactivity costs</H2>
          <P>
            Roughly one in eight dollars of US healthcare spending is
            associated with inadequate physical activity: 11.1% (95% CI
            7.3–14.9) on the 2015 estimate, <Cite id="carlson-2015" /> and
            12.6% (10.5–14.3) — about $205 billion — on the 2025 update,
            which puts the excess at $2,025 a year for inactive adults and
            $1,355 for the insufficiently active, adjusted for smoking,
            obesity, age and insurance status. <Cite id="matjasko-2025" />
          </P>
          <P>
            These are attributions from national survey data, not causal
            estimates. They describe the size of the prize. They do not
            establish that any particular intervention can claim a share of
            it.
          </P>

          <H2 id="insurers">What insurer data shows</H2>
          <P>
            Across 948,974 members of a South African health insurer,
            highly engaged members — 9.5% of the book — had lower cost per
            admission, shorter stays and fewer admissions: 7.4% lower for
            cardiovascular disease, 13.2% for cancers, 20.7% for
            endocrine and metabolic disease. Members with low or no
            engagement showed no cost benefit at all.{" "}
            <Cite id="patel-2010" />
          </P>
          <P>
            A five-year follow-up of 304,054 members used{" "}
            <Em>electronically documented</Em> gym visits rather than
            self-report. Members who stayed highly active through years one
            to three had fewer admissions in years four and five (20.7%
            against 22.2%), and two extra gym visits a week corresponded to
            13% lower odds of admission (OR 0.87, 95% CI 0.80–0.95).{" "}
            <Cite id="patel-2011" />
          </P>
          <P>
            Neither study is randomised, so neither excludes the selection
            effect Illinois measured directly. What the second one does
            establish is timing: claims responded in years four and five,
            not year one.
          </P>
          <Callout>
            Two conditions recur in every dataset where savings appear:
            the activity was <Em>verified</Em> rather than self-reported,
            and the measurement window was long enough for claims to move.
            Any ROI figure offered on a shorter horizon than that is
            describing something else.
          </Callout>

          <H2 id="apps">Can an app move activity at all?</H2>
          <P>
            A systematic review and meta-analysis of 28 randomised trials
            (n = 7,454) of smartphone apps and activity trackers, measured
            against true and active controls, found a pooled effect of SMD
            0.350 (95% CI 0.236–0.465). Among the 21 trials that counted
            steps directly, the raw pooled difference was{" "}
            <Strong>+753 steps a day</Strong> (95% CI 440–971).{" "}
            <Cite id="laranjo-2021" />
          </P>
          <P>
            Personalisation and message-driven design were significantly
            more effective in both subgroup analysis and metaregression.
            That is the category AdimFit sits in, which is a reason to
            expect the upper end of the distribution rather than a reason
            to claim a different number.
          </P>
          <P>
            It is worth being concrete about what +753 buys. A member at
            3,500 steps a day moves to roughly 4,250 — real improvement on
            the steepest part of the dose-response curve, where marginal
            steps are worth the most, and short of the 6,000–8,000 plateau.
            An app is a partial dose. Anything claiming otherwise is
            selling.
          </P>
          <P>
            For comparison, a UK programme rewarding{" "}
            <Em>verified</Em> activity raised annual active days by 56%
            overall and by 554% among previously low-active members,
            sustained over two years — though it measured activity rather
            than claims, and it was observational.{" "}
            <Cite id="hajat-2019" />
          </P>

          {/* ── Correction ───────────────────────────────────────── */}
          <H2 id="correction">Correction</H2>
          <div className="not-prose my-8 rounded-md border border-amber-400/25 bg-amber-400/[0.05] p-5 sm:p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300/90">
              Corrected {CORRECTION.date}
            </p>
            <p className="mt-3 text-[15px] font-medium leading-relaxed text-ink">
              {CORRECTION.summary}
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
              {CORRECTION.detail}
            </p>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="pb-2 pr-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                      Estimate
                    </th>
                    <th className="pb-2 pr-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                      Value
                    </th>
                    <th className="pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                      What it is
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CORRECTION.table.map((row) => (
                    <tr
                      key={row.estimate}
                      className="border-b border-rule last:border-0"
                    >
                      <td
                        className={`py-3 pr-4 text-[13px] ${
                          row.preferred
                            ? "font-medium text-ink"
                            : "text-ink-muted"
                        }`}
                      >
                        {row.estimate}
                      </td>
                      <td
                        className={`py-3 pr-4 font-mono text-[13px] tabular-nums ${
                          row.preferred ? "text-indigo" : "text-ink-muted"
                        }`}
                      >
                        {row.value}
                      </td>
                      <td className="py-3 text-[13px] leading-snug text-ink-muted">
                        {row.meaning}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <H2 id="not-supported">What this evidence does not support</H2>
          <P>
            Stated plainly, because these are the claims the category
            makes and we are not going to make them:
          </P>
          <ul className="my-6 space-y-3">
            {[
              "That participants in a wellness programme cost less because of the programme. Healthy-user selection explains this, and Illinois measured it directly.",
              "Any first-year claims-savings return. Claims responded with a two-to-three-year lag in the insurer data, and not at all at 18 months in the randomised trial.",
              "That apps add 1,850 steps a day. That figure is a unit conversion of a standardised effect. The directly pooled estimate is +753.",
              "That vendor-published return-on-investment figures represent what any particular programme will achieve. They are evidence the category can work, with their caveats attached.",
            ].map((item) => (
              <li
                key={item}
                className="flex gap-3 text-[15px] leading-relaxed text-ink-muted"
              >
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-paper-sunken" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <H2 id="method">How this page was made</H2>
          <P>
            Every figure is traceable to a numbered source below. Where a
            study is observational it is labelled as such. Where a figure
            comes from a vendor rather than a peer-reviewed journal, it is
            not used. Where an earlier version of this page was wrong, the
            correction stays visible above rather than being edited away.
          </P>
          <P>
            This page is drawn from a longer internal review that also
            contains commercial analysis. That part is not published. The
            evidence is public; what we intend to do about it is not.
          </P>

          <H2 id="questions">Common questions</H2>
          <div className="not-prose mt-6 divide-y divide-rule border-y border-rule">
            {QUESTIONS.map((item) => (
              <details key={item.question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 outline-none focus-visible:ring-2 focus-visible:ring-indigo/50">
                  <h3 className="text-[16px] font-medium leading-snug text-ink">
                    {item.question}
                  </h3>
                  <span
                    aria-hidden
                    className="mt-1 font-mono text-[13px] text-ink-faint transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>

          <H2 id="sources">Sources</H2>
          <ol className="not-prose mt-6 space-y-5">
            {CITATIONS.map((source, index) => (
              <li key={source.id} id={source.id} className="flex gap-4">
                <span className="mt-0.5 font-mono text-[12px] tabular-nums text-ink-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-[14px] leading-snug text-ink">
                    {source.authors} ({source.year}).{" "}
                    <a
                      href={source.url}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                      className="underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-indigo"
                    >
                      {source.title}
                    </a>
                    .
                  </p>
                  <p className="mt-1 text-[13px] text-ink-faint">
                    {source.publication}
                    {source.identifier ? ` · ${source.identifier}` : ""}
                  </p>
                  <p className="mt-1 text-[13px] italic text-ink-faint">
                    {source.weight}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Prose>

        <div className="mt-14 border-t border-rule pt-8">
          <p className="text-[13px] leading-relaxed text-ink-faint">
            AdimFit provides general fitness guidance and is not a
            substitute for medical advice. Nothing on this page is a
            recommendation about insurance cover or a claim about any
            individual&apos;s health.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-full border border-rule px-5 py-2.5 text-[13px] font-medium text-ink-muted outline-none transition-colors hover:border-indigo/40 hover:text-ink focus-visible:ring-2 focus-visible:ring-indigo/50"
          >
            What AdimFit is
          </Link>
        </div>
      </article>
    </div>
  );
}

/* ══ Typography primitives ════════════════════════════════════════ */
/* Local rather than from a prose plugin: this page has exactly one
   layout, and the rules it needs are few enough to state. */

function Prose({ children }: { children: React.ReactNode }) {
  return <div className="mt-12">{children}</div>;
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-14 scroll-mt-8 text-[1.6rem] font-semibold leading-[1.15] tracking-[-0.02em] text-ink first:mt-0"
    >
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 text-[16px] leading-[1.75] text-ink-muted">{children}</p>
  );
}

function Em({ children }: { children: React.ReactNode }) {
  return <em className="not-italic text-ink">{children}</em>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-indigo">{children}</strong>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <p className="my-8 border-l-2 border-indigo/50 pl-5 text-[16px] leading-[1.7] text-ink-muted">
      {children}
    </p>
  );
}

/** An inline superscript that links to the numbered source list. */
function Cite({ id }: { id: string }) {
  const index = CITATIONS.findIndex((source) => source.id === id);
  if (index === -1) throw new Error(`[research] unknown citation: ${id}`);
  return (
    <a
      href={`#${id}`}
      className="ml-0.5 align-super font-mono text-[11px] text-indigo/80 no-underline outline-none transition-colors hover:text-indigo focus-visible:ring-2 focus-visible:ring-indigo/50"
      aria-label={`Source ${index + 1}`}
    >
      [{index + 1}]
    </a>
  );
}
