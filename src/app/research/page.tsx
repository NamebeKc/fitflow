// src/app/research/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

import { ARTICLE, CITATIONS } from "@/content/research/exercise-and-claims";
import { OG_IMAGE, absoluteUrl } from "@/lib/site";

/**
 * ── THE RESEARCH INDEX ──────────────────────────────────────────────
 * One entry today. It exists anyway, for two reasons.
 *
 * A single article at a bare URL reads as a one-off; an index reads as
 * a practice, and the difference shows up in whether a retrieval
 * system treats the writing as a source or as a landing page. It is
 * also the honest structure — more of these are coming, and a section
 * that has to be invented later gets invented badly.
 *
 * The standards paragraph is not filler. It is the part a sceptical
 * reader checks before deciding whether to believe the numbers, and
 * it commits us in public to the rules the articles follow.
 * ─────────────────────────────────────────────────────────────────────
 */

export const metadata: Metadata = {
  title: "Research",
  description:
    "Sourced reviews of the evidence behind the claims AdimFit makes about exercise — including corrections, and including the findings that do not favour us.",
  alternates: { canonical: "/research" },
  openGraph: {
    type: "website",
    title: "Research · AdimFit",
    description:
      "Sourced reviews of the evidence behind the claims AdimFit makes about exercise, including corrections.",
    url: absoluteUrl("/research"),
    images: [OG_IMAGE],
  },
};

const ARTICLES = [ARTICLE];

export default function ResearchIndexPage() {
  return (
    <div className="min-h-dvh bg-paper text-ink antialiased">
      <header className="border-b border-rule">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-6 py-6 md:px-8">
          <Link
            href="/"
            className="outline-none focus-visible:ring-2 focus-visible:ring-indigo/50"
          >
            <Image
              src="/logo-horizontal.png"
              alt="AdimFit"
              width={1646}
              height={430}
              className="h-9 w-auto"
            />
          </Link>
          <a
            href="/#auth"
            className="rounded-full border border-rule px-4 py-2 text-[13px] font-medium text-ink-muted outline-none transition-colors hover:border-indigo/40 hover:text-ink focus-visible:ring-2 focus-visible:ring-indigo/50"
          >
            Try AdimFit
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[860px] px-6 py-14 md:px-8 md:py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-indigo">
          Research
        </p>
        <h1 className="mt-6 text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[2.6rem]">
          The working, shown.
        </h1>
        <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-ink-muted">
          AdimFit makes claims about exercise on its marketing pages.
          These are the reviews those claims rest on, with every figure
          tied to a source you can open.
        </p>

        <ul className="mt-12 space-y-4">
          {ARTICLES.map((article) => (
            <li key={article.slug}>
              <Link
                href={`/research/${article.slug}`}
                className="group block rounded-lg border border-rule bg-paper-raised p-6 outline-none transition-colors hover:border-indigo/30 focus-visible:ring-2 focus-visible:ring-indigo/50 sm:p-8"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  <time dateTime={article.published}>21 September 2026</time>
                  <span className="px-2 text-ink-faint">·</span>
                  {article.readingMinutes} min
                  <span className="px-2 text-ink-faint">·</span>
                  {CITATIONS.length} sources
                </p>

                <h2 className="mt-4 text-2xl font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
                  {article.title}
                </h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
                  {article.subtitle}
                </p>

                <span className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-indigo">
                  Read the review
                  <span
                    aria-hidden
                    className="transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* ── The standards these follow ───────────────────────────── */}
        <section className="mt-16 rounded-lg border border-rule p-6 sm:p-8">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            How these are written
          </h2>
          <ul className="mt-6 space-y-3.5">
            {[
              "Every figure is traceable to a numbered source. If it cannot be, it is not published.",
              "Observational findings are labelled observational. Randomised findings are labelled randomised. The difference is usually the whole story.",
              "Vendor-published results are not used as evidence of what AdimFit will achieve.",
              "Commercial interest is declared at the top of each piece, because we have one.",
              "Corrections stay visible on the page. Editing a mistake away is how a mistake becomes a pattern.",
            ].map((rule) => (
              <li
                key={rule}
                className="flex gap-3 text-[15px] leading-relaxed text-ink-muted"
              >
                <span
                  aria-hidden
                  className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo/60"
                />
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
