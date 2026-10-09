// src/components/content/ArticleLayout.tsx
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { GUIDES, guide, guideDate, type Guide } from "@/content/guides";
import { PLANS, TRIAL_DAYS } from "@/lib/plan-catalogue";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * ── ONE LAYOUT FOR EVERY GUIDE ──────────────────────────────────────
 * A server component. Nothing in a written page needs the browser, so
 * nothing here ships JavaScript — the whole point of the cluster is
 * that its text sits in the HTML where a crawler, and an assistant
 * that does not execute JavaScript, can read it.
 *
 * It owns the three pieces of structured data every article needs and
 * every article gets wrong when they are written by hand:
 *
 *   Article        — authorship and dates
 *   FAQPage        — built from the guide's own `faqs`, so the schema
 *                    cannot claim an answer the page does not show
 *   BreadcrumbList — Home › Guides › this page
 *
 * The call to action at the foot is deliberately quiet and its prices
 * come from the plan catalogue. A guide that argues honestly and then
 * shouts at the reader has wasted the credit it just earned.
 * ─────────────────────────────────────────────────────────────────────
 */

export function ArticleLayout({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const entry = guide(slug);
  const url = absoluteUrl(`/guides/${entry.slug}`);

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: entry.title,
        description: entry.description,
        url,
        datePublished: entry.published,
        dateModified: entry.modified,
        inLanguage: "en",
        isAccessibleForFree: true,
        author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        publisher: { "@id": `${SITE_URL}/#organization` },
        mainEntityOfPage: url,
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: entry.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: "Guides",
            item: absoluteUrl("/guides"),
          },
          { "@type": "ListItem", position: 3, name: entry.h1, item: url },
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

      <SiteHeader />

      <article className="mx-auto w-full max-w-[720px] px-5 py-12 md:px-8 md:py-16">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
            <li>
              <Link href="/" className="transition-colors hover:text-white/70">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/guides" className="transition-colors hover:text-white/70">
                Guides
              </Link>
            </li>
          </ol>
        </nav>

        <h1 className="text-[2.1rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[2.5rem]">
          {entry.h1}
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-white/60">
          {entry.summary}
        </p>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
          <time dateTime={entry.published}>{guideDate(entry.published)}</time>
          <span className="px-2 text-white/20">·</span>
          {entry.readingMinutes} min read
        </p>

        <div className="mt-12">{children}</div>

        <FaqBlock entry={entry} />
        <Related entry={entry} />
        <CallToAction />
      </article>

      <SiteFooter />
    </div>
  );
}

/* ══ Page furniture ═══════════════════════════════════════════════ */

function SiteHeader() {
  return (
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
        <nav className="flex items-center gap-4">
          <Link
            href="/guides"
            className="text-[13px] text-white/60 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
          >
            Guides
          </Link>
          <Link
            href="/#auth"
            className="rounded-full border border-white/12 px-4 py-2 text-[13px] font-medium text-white/70 outline-none transition-colors hover:border-[#CCFF00]/40 hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
          >
            Try AdimFit
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.07]">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 px-5 py-8 text-[13px] text-white/45 md:flex-row md:items-center md:justify-between md:px-8">
        <p>
          AdimFit provides general fitness guidance and is not a substitute
          for medical advice.
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/guides" className="transition-colors hover:text-white/80">
            Guides
          </Link>
          <Link href="/research" className="transition-colors hover:text-white/80">
            Research
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-white/80">
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-white/80">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}

function FaqBlock({ entry }: { entry: Guide }) {
  return (
    <section className="mt-16" aria-labelledby="faq-heading">
      <h2
        id="faq-heading"
        className="text-[1.6rem] font-semibold leading-[1.15] tracking-[-0.02em]"
      >
        Common questions
      </h2>
      <div className="mt-6 divide-y divide-white/[0.07] border-y border-white/[0.07]">
        {entry.faqs.map((faq) => (
          <details key={faq.question} className="group py-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 outline-none focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50">
              <h3 className="text-[16px] font-medium leading-snug text-white/90">
                {faq.question}
              </h3>
              <span
                aria-hidden
                className="mt-1 font-mono text-[13px] text-white/40 transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-[15px] leading-relaxed text-white/60">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Related({ entry }: { entry: Guide }) {
  const others = entry.related
    .map((slug) => GUIDES.find((g) => g.slug === slug))
    .filter((g): g is Guide => Boolean(g));

  if (others.length === 0) return null;

  return (
    <section className="mt-16" aria-labelledby="related-heading">
      <h2
        id="related-heading"
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50"
      >
        Read next
      </h2>
      <ul className="mt-5 space-y-3">
        {others.map((other) => (
          <li key={other.slug}>
            <Link
              href={`/guides/${other.slug}`}
              className="group flex items-start justify-between gap-6 rounded-2xl border border-white/[0.09] bg-[#14161A] px-5 py-4 outline-none transition-colors hover:border-[#CCFF00]/30 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
            >
              <span>
                <span className="block text-[15px] font-medium text-white/90">
                  {other.h1}
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-white/50">
                  {other.summary}
                </span>
              </span>
              <ArrowRight
                className="mt-1 size-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-1"
                strokeWidth={2.5}
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CallToAction() {
  return (
    <aside className="mt-16 rounded-3xl border border-[#CCFF00]/20 bg-gradient-to-b from-[#CCFF00]/[0.07] to-transparent p-6 sm:p-8">
      <h2 className="text-[1.4rem] font-semibold leading-[1.15] tracking-[-0.02em]">
        A coach that keeps the record for you
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed text-white/60">
        AdimFit logs each session in seconds and builds the next one from
        what you actually did. {PLANS.monthly_usd.display} a month, or{" "}
        {PLANS.annual_usd_2026.display} a year. {TRIAL_DAYS}-day free trial,
        no card required.
      </p>
      <Link
        href="/#auth"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#CCFF00] px-6 py-3 text-[14px] font-semibold text-black outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 active:scale-[0.99]"
      >
        Start free
        <ArrowRight className="size-4" strokeWidth={2.5} />
      </Link>
    </aside>
  );
}

/* ══ Prose primitives ═════════════════════════════════════════════ */
/* Local, small, and shared by every guide, so the cluster reads as
   one publication rather than three pages that happen to share a
   colour scheme. */

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-14 scroll-mt-8 text-[1.6rem] font-semibold leading-[1.15] tracking-[-0.02em] text-white first:mt-0"
    >
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-9 text-[1.15rem] font-semibold leading-snug tracking-[-0.01em] text-white/90">
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-5 text-[16px] leading-[1.75] text-white/70">{children}</p>
  );
}

export function Em({ children }: { children: ReactNode }) {
  return <em className="not-italic text-white/90">{children}</em>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-[#CCFF00]">{children}</strong>;
}

export function Callout({ children }: { children: ReactNode }) {
  return (
    <p className="my-8 border-l-2 border-[#CCFF00]/50 pl-5 text-[16px] leading-[1.7] text-white/75">
      {children}
    </p>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="my-6 space-y-3">
      {items.map((item, index) => (
        <li
          key={index}
          className="flex gap-3 text-[16px] leading-[1.7] text-white/70"
        >
          <span
            aria-hidden
            className="mt-[0.6rem] size-1.5 shrink-0 rounded-full bg-[#CCFF00]/60"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** A copy-pasteable block. Monospace, selectable, visibly a quotation. */
export function PromptBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <figure className="my-8 overflow-hidden rounded-2xl border border-white/[0.09] bg-black/40">
      <figcaption className="border-b border-white/[0.07] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
        {label}
      </figcaption>
      <pre className="overflow-x-auto px-5 py-5 font-mono text-[13px] leading-[1.7] text-white/75">
        <code className="whitespace-pre-wrap">{children}</code>
      </pre>
    </figure>
  );
}

/** A two-column comparison. Mobile stacks it; nothing is truncated. */
export function CompareTable({
  left,
  right,
  rows,
}: {
  left: string;
  right: string;
  rows: { aspect: string; left: string; right: string }[];
}) {
  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-white/[0.09]">
      <div className="grid grid-cols-[1fr_1fr] gap-px bg-white/[0.07] sm:grid-cols-[0.9fr_1fr_1fr]">
        <div className="hidden bg-[#0D0F13] px-4 py-3 sm:block" />
        <div className="bg-[#0D0F13] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/50">
          {left}
        </div>
        <div className="bg-[#0D0F13] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#CCFF00]">
          {right}
        </div>

        {rows.map((row) => (
          <div key={row.aspect} className="contents">
            <div className="col-span-2 bg-[#101216] px-4 py-3 text-[13px] font-medium text-white/80 sm:col-span-1 sm:bg-[#14161A] sm:py-4">
              {row.aspect}
            </div>
            <div className="bg-[#14161A] px-4 py-4 text-[13px] leading-relaxed text-white/50">
              {row.left}
            </div>
            <div className="bg-[#14161A] px-4 py-4 text-[13px] leading-relaxed text-white/80">
              {row.right}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A table of figures that came from somewhere.
 *
 * `caption` is not decoration — a price table with no stated source
 * and no date is the single most common way a content page quietly
 * becomes wrong, and the reader has no way to tell when it happened.
 */
export function DataTable({
  columns,
  rows,
  caption,
}: {
  columns: string[];
  rows: string[][];
  caption: string;
}) {
  return (
    <figure className="my-8">
      <div className="overflow-x-auto rounded-2xl border border-white/[0.09]">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="bg-[#0D0F13]">
              {columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50 sm:px-5"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row[0]}
                className="border-t border-white/[0.07] bg-[#14161A]"
              >
                {row.map((cell, i) => (
                  <td
                    key={i}
                    className={
                      i === 0
                        ? "px-4 py-3.5 text-[14px] font-medium text-white/85 sm:px-5"
                        : "px-4 py-3.5 font-mono text-[13px] tabular-nums text-white/65 sm:px-5"
                    }
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="mt-3 text-[13px] leading-relaxed text-white/40">
        {caption}
      </figcaption>
    </figure>
  );
}

export interface SourceRef {
  name: string;
  detail: string;
  url: string;
}

/** Numbered, linked, and honest about what each source is. */
export function Sources({ items }: { items: SourceRef[] }) {
  return (
    <ol className="mt-6 space-y-4">
      {items.map((item, index) => (
        <li key={item.url} className="flex gap-4">
          <span className="mt-0.5 font-mono text-[12px] tabular-nums text-white/30">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] leading-snug text-white/80">
              <a
                href={item.url}
                rel="noopener noreferrer nofollow"
                target="_blank"
                className="underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-[#CCFF00]"
              >
                {item.name}
              </a>
            </p>
            <p className="mt-1 text-[13px] italic text-white/40">{item.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
