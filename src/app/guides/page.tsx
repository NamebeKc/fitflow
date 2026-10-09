// src/app/guides/page.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { GUIDES, guideDate } from "@/content/guides";
import { OG_IMAGE, SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * ── THE HUB ─────────────────────────────────────────────────────────
 * The page every guide links back to and that links to every guide.
 *
 * This is the part of a content cluster people skip, and skipping it
 * is why isolated blog posts underperform: authority arriving at one
 * page has nowhere to travel. A hub gives the cluster a shape a
 * crawler can follow, and gives a reader who liked one piece an
 * obvious next one.
 *
 * `ItemList` structured data states that shape explicitly rather than
 * leaving it to be inferred from markup.
 * ─────────────────────────────────────────────────────────────────────
 */

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Plain, sourced writing on training with an AI coach — what ChatGPT can and cannot do for a workout plan, and why most plans fall apart.",
  alternates: { canonical: "/guides" },
  openGraph: {
    type: "website",
    title: "Guides · AdimFit",
    description:
      "Plain writing on training with an AI coach — what ChatGPT can and cannot do for a workout plan, and why most plans fall apart.",
    url: absoluteUrl("/guides"),
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    images: [OG_IMAGE.url],
  },
};

export default function GuidesIndexPage() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${absoluteUrl("/guides")}#collection`,
        name: "AdimFit Guides",
        url: absoluteUrl("/guides"),
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "ItemList",
        "@id": `${absoluteUrl("/guides")}#list`,
        itemListElement: GUIDES.map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: entry.title,
          url: absoluteUrl(`/guides/${entry.slug}`),
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${absoluteUrl("/guides")}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Guides",
            item: absoluteUrl("/guides"),
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-dvh bg-[#090A0C] text-white antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
      />

      <header className="border-b border-white/[0.07]">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 md:px-8">
          <Link
            href="/"
            className="outline-none focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
          >
            <Image
              src="/logo-horizontal.png"
              alt="AdimFit"
              width={1646}
              height={430}
              className="h-9 w-auto"
            />
          </Link>
          <Link
            href="/#auth"
            className="rounded-full border border-white/12 px-4 py-2 text-[13px] font-medium text-white/70 outline-none transition-colors hover:border-[#CCFF00]/40 hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
          >
            Try AdimFit
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[860px] px-5 py-14 md:px-8 md:py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#CCFF00]">
          Guides
        </p>
        <h1 className="mt-5 text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[2.6rem]">
          Training, explained properly.
        </h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/60">
          Writing about what actually works when you are planning your own
          training — including the parts where the free option is good
          enough and we say so.
        </p>

        <ul className="mt-12 space-y-4">
          {GUIDES.map((entry) => (
            <li key={entry.slug}>
              <Link
                href={`/guides/${entry.slug}`}
                className="group block rounded-3xl border border-white/[0.09] bg-[#14161A] p-6 outline-none transition-colors hover:border-[#CCFF00]/30 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 sm:p-8"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                  <span className="text-[#CCFF00]/80">{entry.topic}</span>
                  <span className="px-2 text-white/20">·</span>
                  <time dateTime={entry.published}>
                    {guideDate(entry.published)}
                  </time>
                  <span className="px-2 text-white/20">·</span>
                  {entry.readingMinutes} min
                </p>

                <h2 className="mt-4 text-2xl font-semibold leading-[1.15] tracking-[-0.02em] text-white">
                  {entry.h1}
                </h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/60">
                  {entry.summary}
                </p>

                <span className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-[#CCFF00]">
                  Read
                  <ArrowRight
                    className="size-3.5 transition-transform group-hover:translate-x-1"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <section className="mt-16 rounded-3xl border border-white/[0.09] p-6 sm:p-8">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
            Also here
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            For the evidence behind the claims AdimFit makes about exercise —
            with citations, and with corrections kept visible — see the{" "}
            <Link
              href="/research"
              className="text-white underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-[#CCFF00]"
            >
              research reviews
            </Link>
            . Those are written for insurers, employers and anyone auditing
            what we say, rather than for someone choosing a coach.
          </p>
        </section>
      </main>
    </div>
  );
}
