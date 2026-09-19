// src/components/billing/PaywallFlow.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { Paywall } from "@/components/billing/Paywall";
import { useProfile } from "@/components/providers/ProfileProvider";
import {
  activityLabel,
  environmentLabel,
  equipmentLabel,
  goalLabel,
  profileGoals,
  type GoalId,
} from "@/lib/profile";

/**
 * ── VALUE BEFORE PRICE ──────────────────────────────────────────────
 * Three screens, then the paywall. The order is the whole point: a
 * price shown before the thing it buys is an amount; shown after, it
 * is a trade.
 *
 * WHAT THESE SCREENS ARE ALLOWED TO SAY.
 *
 * Screens 1 and 2 make no claims at all. They reflect back what the
 * person entered during onboarding and state what the coach will
 * actually do with it — the copy on screen 2 is a plain-English
 * rendering of GOAL_RULES in `api/chat/route.ts`, so the promise here
 * and the behaviour there cannot drift into marketing.
 *
 * Screen 3 carries the only external claim in the flow, and it is
 * deliberately the most conservative form of it:
 *
 *   • The headline figure is the DIRECTLY POOLED mean difference in
 *     daily steps, +753 (95% CI 440–971), not the +1,850 that the
 *     same paper reports after converting from standardised mean
 *     differences. Both are in Laranjo et al.; the larger one is a
 *     derived quantity and choosing it on a payment screen would be
 *     picking the flattering estimate.
 *   • GRADE certainty (low-to-moderate) is shown, not buried.
 *   • The limitation that sinks the strong version of this claim —
 *     most trials bundled apps with other components, so the app
 *     alone is not isolated — is printed on the same screen.
 *
 * WHAT IS DELIBERATELY ABSENT. No projected weight loss, no goal
 * date, no mortality or disease-risk statistics. The dose-response
 * step literature is observational, graded moderate at best, drawn
 * from generally healthy cohorts, and explicitly not causal. A
 * number like "47% lower risk of death" beside a subscription price
 * is selling an outcome this product cannot deliver to an individual,
 * and it is a health claim under the FCCPA. The evidence that belongs
 * here is evidence about the intervention, not about the disease.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Plain-English mirror of GOAL_RULES in `api/chat/route.ts`.
 *
 * Kept in sync by hand and on purpose: that file is server-side and
 * builds a system prompt, this one is copy. If the coach's rules
 * change, these change with them — a paywall that describes a
 * different product from the one delivered is the most expensive kind
 * of inaccuracy.
 */
const GOAL_PLAN: Record<GoalId, { title: string; lines: string[] }> = {
  strength: {
    title: "Compound lifts first, while you're fresh",
    lines: [
      "3–5 sets of 4–8 reps at a load that is genuinely hard",
      "90–180 seconds between working sets — short rest costs you the adaptation",
      "Progress by adding load before adding reps, 4–6 movements a session",
    ],
  },
  "weight-loss": {
    title: "Total work and an elevated heart rate",
    lines: [
      "Circuits and supersets, 10–15 reps, 30–60 seconds rest",
      "10–20 minutes of conditioning on top",
      "Resistance work stays in — cardio alone costs you muscle",
    ],
  },
  endurance: {
    title: "An aerobic base you can actually build on",
    lines: [
      "Progressive duration at conversational pace",
      "One harder interval session a week, not more — roughly 80/20 easy to hard",
      "Supporting strength work, 12–20 reps, for injury resilience",
    ],
  },
  mobility: {
    title: "Range of motion under control",
    lines: [
      "30–60 second holds, controlled tempo, 2–3 sets",
      "Loaded stretching combined with joint-specific work",
      "Frequency beats intensity — shorter sessions, more often",
    ],
  },
  general: {
    title: "Balanced full-body work",
    lines: [
      "3–4 sets of 8–12 reps, 60–90 seconds rest",
      "Push, pull, hinge, squat and core across the week",
      "Resistance work mixed with conditioning, progressing on both",
    ],
  },
};

const SEEN_KEY = "adimfit:paywall-flow-seen";
const STEPS = ["goals", "plan", "evidence", "price"] as const;

export function PaywallFlow({
  onReachedPrice,
}: {
  onReachedPrice?: () => void;
}) {
  const { profile } = useProfile();
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const announced = useRef<Set<number>>(new Set());

  const goals = useMemo(() => profileGoals(profile), [profile]);
  const primary = goals[0] ?? "general";
  const secondary = goals[1];

  /**
   * A returning visitor goes straight to the price.
   *
   * The value screens earn their place once. Making someone walk three
   * screens every time they open the app turns persuasion into a toll
   * gate, and the second viewing persuades nobody.
   */
  useEffect(() => {
    try {
      if (window.localStorage.getItem(SEEN_KEY)) setStep(STEPS.length - 1);
    } catch {
      // Private mode — show the full flow, which is the safe default.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || announced.current.has(step)) return;
    announced.current.add(step);
    track("paywall_step_viewed", { step: STEPS[step], goal_primary: primary });

    if (step === STEPS.length - 1) {
      onReachedPrice?.();
      try {
        window.localStorage.setItem(SEEN_KEY, "1");
      } catch {
        // Non-fatal.
      }
    }
  }, [ready, step, primary, onReachedPrice]);

  if (!ready) return null;

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div className="mx-auto w-full max-w-lg">
      <Progress step={step} total={STEPS.length} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, y: -12 }}
          transition={transition}
        >
          {step === 0 && <GoalsScreen profile={profile} goals={goals} />}
          {step === 1 && (
            <PlanScreen primary={primary} secondary={secondary} />
          )}
          {step === 2 && <EvidenceScreen />}
          {step === 3 && (
            <Paywall
              headline={`Ready when you are, ${profile?.firstName ?? "there"}`}
              subline="Your plan is built. Subscribe to start training with it."
            />
          )}
        </motion.div>
      </AnimatePresence>

      {step < STEPS.length - 1 && (
        <div className="mt-6 flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((current) => current - 1)}
              className="flex size-12 shrink-0 items-center justify-center rounded-full border border-white/12 text-white/60 outline-none transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" strokeWidth={2.5} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setStep((current) => current + 1)}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-6 py-3.5 text-[15px] font-semibold text-black shadow-[0_10px_40px_-12px_rgba(204,255,0,0.5)] outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 active:scale-[0.99]"
          >
            {step === STEPS.length - 2 ? "See your options" : "Continue"}
            <ArrowRight className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Screens ──────────────────────────────────────────────────────── */

function GoalsScreen({
  profile,
  goals,
}: {
  profile: ReturnType<typeof useProfile>["profile"];
  goals: GoalId[];
}) {
  const chips = [
    ...goals.map(goalLabel),
    ...(profile?.activities ?? []).map(activityLabel),
    ...(profile?.environment ?? []).map(environmentLabel),
  ];

  return (
    <Shell
      eyebrow="Step one"
      title={`This is what you're training for, ${profile?.firstName ?? "there"}`}
      body="Everything your coach prescribes is built from these. Nothing here is a template."
    >
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-white/[0.09] bg-black/30 px-3.5 py-2 text-[13px] text-white/70"
          >
            {chip}
          </span>
        ))}
      </div>

      {(profile?.equipment?.length ?? 0) > 0 && (
        <p className="mt-5 text-[13px] leading-relaxed text-white/50">
          Working with{" "}
          <span className="text-white/75">
            {(profile?.equipment ?? []).map(equipmentLabel).join(", ")}
          </span>
          . Your coach never prescribes a movement you have no way to do.
        </p>
      )}
    </Shell>
  );
}

function PlanScreen({
  primary,
  secondary,
}: {
  primary: GoalId;
  secondary?: GoalId;
}) {
  const plan = GOAL_PLAN[primary];

  return (
    <Shell
      eyebrow="Step two"
      title={plan.title}
      body={`How your sessions are actually structured for ${goalLabel(primary).toLowerCase()}.`}
    >
      <ul className="space-y-2.5">
        {plan.lines.map((line) => (
          <li key={line} className="flex items-start gap-2.5">
            <Check
              className="mt-0.5 size-3.5 shrink-0 text-[#CCFF00]"
              strokeWidth={3}
            />
            <span className="text-[14px] leading-relaxed text-white/70">
              {line}
            </span>
          </li>
        ))}
      </ul>

      {secondary && secondary !== primary && (
        <p className="mt-5 rounded-xl border border-white/[0.07] bg-black/30 px-3.5 py-3 text-[13px] leading-relaxed text-white/60">
          <span className="text-white/80">
            {goalLabel(secondary)} gets its own days.
          </span>{" "}
          Sessions follow {goalLabel(primary).toLowerCase()} — roughly two to
          one across the week — rather than blending both into a compromise
          that serves neither.
        </p>
      )}
    </Shell>
  );
}

function EvidenceScreen() {
  return (
    <Shell
      eyebrow="Step three"
      title="Why a coach that adapts beats one that doesn't"
      body="The strongest evidence for this kind of product, stated the way the researchers stated it."
    >
      <div className="rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.05] p-4">
        <p className="font-mono text-3xl tabular-nums text-[#CCFF00]">+753</p>
        <p className="mt-1 text-[13px] leading-relaxed text-white/70">
          extra steps a day, pooled across 21 randomised trials of apps and
          activity trackers{" "}
          <span className="text-white/45">(95% CI 440–971)</span>
        </p>
      </div>

      <p className="mt-4 text-[14px] leading-relaxed text-white/70">
        The same review tested <em>which</em> features did the work.
        Personalisation and messaging were the two that reached significance —
        the difference between a coach that knows your history and an app that
        shows you a number.
      </p>

      {/*
        Printed on the same screen as the claim, not in a footnote. A
        limitation a reader has to go looking for is a limitation the
        page is hiding.
      */}
      <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/30 px-3.5 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
          What this doesn&apos;t show
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/55">
          Most trials bundled apps with other support, so the app alone
          isn&apos;t isolated. The authors grade the evidence low-to-moderate.
          It says this category of tool moves activity — not what will happen
          to you specifically.
        </p>
      </div>

      <a
        href="https://pubmed.ncbi.nlm.nih.gov/33355160/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-white/45 underline underline-offset-4 transition-colors hover:text-white/80"
      >
        Laranjo et al., British Journal of Sports Medicine, 2021
        <ExternalLink className="size-3" strokeWidth={2} />
      </a>
    </Shell>
  );
}

/* ── Chrome ───────────────────────────────────────────────────────── */

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-5 flex gap-1.5" aria-hidden>
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-300",
            index <= step ? "bg-[#CCFF00]" : "bg-white/10",
          )}
        />
      ))}
    </div>
  );
}

function Shell({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/[0.09] bg-[#14161A] p-6 sm:p-7">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#CCFF00]">
        {eyebrow}
      </p>
      <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">
        {title}
      </h2>
      <p className="mt-2.5 text-[15px] leading-relaxed text-white/60">{body}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}
