// src/components/dashboard/WelcomeState.tsx
"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, Sparkles, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

interface WelcomeStateProps {
  displayName?: string | null;
  hasProfile: boolean;
}

/**
 * First-run dashboard.
 *
 * A new user has no numbers to show, so instead of empty tiles they
 * get a short path: set up, log something, meet the coach. The
 * completed step is checked off so progress is legible.
 */
export function WelcomeState({ displayName, hasProfile }: WelcomeStateProps) {
  const firstName = displayName?.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <section className="rounded-lg border border-rule bg-paper-raised p-6 md:p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-indigo/70">
          Getting started
        </p>

        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-ink">
          {firstName ? `Welcome, ${firstName}.` : "Welcome to Fitflow."}
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">
          Two quick steps and your coach can start building plans around
          your goals and history.
        </p>

        <ol className="mt-7 space-y-3">
          <StepLink
            href="/profile"
            icon={UserRound}
            step="01"
            title="Set up your profile"
            description="Goal, activities, and where you train."
            done={hasProfile}
          />
          <StepLink
            href="/log"
            icon={ClipboardList}
            step="02"
            title="Log your first workout"
            description="Even a short walk counts — it gives your coach a starting point."
            done={false}
          />
        </ol>
      </section>

      <section className="flex items-center gap-4 rounded-lg border border-indigo/15 bg-indigo/[0.04] p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-indigo/20 bg-indigo/[0.07]">
          <Sparkles className="size-4 text-indigo" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">In a hurry? Just ask.</p>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
            Your coach can help right now, even before setup.
          </p>
        </div>
        <Link
          href="/coach"
          className="shrink-0 rounded-full bg-indigo px-4 py-2 text-sm font-semibold text-black outline-none transition-all hover:bg-indigo-lift focus-visible:ring-2 focus-visible:ring-indigo/60 active:scale-[0.99]"
        >
          Open
        </Link>
      </section>
    </div>
  );
}

function StepLink({
  href,
  icon: Icon,
  step,
  title,
  description,
  done,
}: {
  href: string;
  icon: typeof UserRound;
  step: string;
  title: string;
  description: string;
  done: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-start gap-4 rounded-md border border-rule bg-ink/30 p-4 outline-none transition-all hover:border-indigo/25 focus-visible:ring-2 focus-visible:ring-indigo/50 active:scale-[0.995]"
      >
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md border transition-colors",
            done
              ? "border-indigo/30 bg-indigo/10 text-indigo"
              : "border-rule bg-paper-sunken text-ink-muted",
          )}
        >
          <Icon className="size-[18px]" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
            {step}
            {done && <span className="text-indigo/70">Done</span>}
          </p>
          <p className="mt-1 text-sm font-medium text-ink">{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
            {description}
          </p>
        </div>

        <ArrowRight
          className="mt-1 size-4 shrink-0 text-ink-faint transition-colors group-hover:text-indigo"
          strokeWidth={2}
        />
      </Link>
    </li>
  );
}