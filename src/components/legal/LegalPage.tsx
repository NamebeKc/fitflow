// src/components/legal/LegalPage.tsx
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

interface LegalPageProps {
  title: string;
  updated: string;
  children: ReactNode;
}

/**
 * Shell for policy documents.
 *
 * These pages sit OUTSIDE the authenticated app: someone reading your
 * privacy policy before signing up must be able to reach it, and a
 * regulator or payment processor will check it without an account.
 * They therefore carry their own header and footer rather than the
 * app chrome.
 *
 * Measure is capped around 68 characters — long legal text at full
 * width is genuinely harder to read, and these are documents people
 * are already reluctant to read.
 */
export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <div className="min-h-dvh bg-[#090A0C] text-white">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-6 md:px-8">
        <Link href="/" className="flex items-center gap-3 outline-none">
          <Image
            src="/logo-horizontal.png"
            alt="AdimFit"
            width={1646}
            height={430}
            className="h-9 w-auto"
          />
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/60 outline-none transition-colors hover:border-[#CCFF00]/30 hover:text-[#CCFF00] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
        >
          <ArrowLeft className="size-3" strokeWidth={2.5} />
          Back
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-20 pt-6 md:px-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#CCFF00]/70">
          Legal
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-white/50">
          Last updated {updated}
        </p>

        <div className="mt-10 max-w-[68ch] space-y-8">{children}</div>
      </main>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-8 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50 md:px-8">
          <Link
            href="/privacy"
            className="transition-colors hover:text-white/80"
          >
            Privacy
          </Link>
          <Link href="/terms" className="transition-colors hover:text-white/80">
            Terms
          </Link>
          <span className="ml-auto">AdimFit</span>
        </div>
      </footer>
    </div>
  );
}

/** A titled section of a policy document. */
export function Section({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">
        {heading}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-white/60">
        {children}
      </div>
    </section>
  );
}

/** Bulleted list styled for policy text. */
export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span
            aria-hidden
            className="mt-[0.6em] size-1 shrink-0 rounded-full bg-[#CCFF00]/50"
          />
          <span className="flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}