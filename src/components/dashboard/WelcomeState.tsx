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
      <section className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-6 md:p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#CCFF00]/70">
          Getting started
        </p>

        <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">
          {firstName ? `Welcome, ${firstName}.` : "Welcome to Fitflow."}
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-white/60">
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

      <section className="flex items-center gap-4 rounded-3xl border border-[#CCFF00]/15 bg-[#CCFF00]/[0.04] p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.07]">
          <Sparkles className="size-4 text-[#CCFF00]" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">In a hurry? Just ask.</p>
          <p className="mt-0.5 text-sm leading-relaxed text-white/60">
            Your coach can help right now, even before setup.
          </p>
        </div>
        <Link
          href="/coach"
          className="shrink-0 rounded-full bg-[#CCFF00] px-4 py-2 text-sm font-semibold text-black outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 active:scale-[0.99]"
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
        className="group flex items-start gap-4 rounded-2xl border border-white/[0.07] bg-black/30 p-4 outline-none transition-all hover:border-[#CCFF00]/25 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 active:scale-[0.995]"
      >
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
            done
              ? "border-[#CCFF00]/30 bg-[#CCFF00]/10 text-[#CCFF00]"
              : "border-white/[0.07] bg-white/[0.03] text-white/50",
          )}
        >
          <Icon className="size-[18px]" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
            {step}
            {done && <span className="text-[#CCFF00]/70">Done</span>}
          </p>
          <p className="mt-1 text-sm font-medium text-white">{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-white/60">
            {description}
          </p>
        </div>

        <ArrowRight
          className="mt-1 size-4 shrink-0 text-white/40 transition-colors group-hover:text-[#CCFF00]"
          strokeWidth={2}
        />
      </Link>
    </li>
  );
}