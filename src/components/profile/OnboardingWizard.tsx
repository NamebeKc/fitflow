// src/components/profile/OnboardingWizard.tsx
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Building2,
  Check,
  Dumbbell,
  Flame,
  Flower2,
  Footprints,
  HeartPulse,
  Home,
  Luggage,
  MapPin,
  PersonStanding,
  Sparkles,
  Trees,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ACTIVITIES,
  COACHING_STYLES,
  ENVIRONMENTS,
  EQUIPMENT,
  GOALS,
  needsEquipmentQuestion,
  type ActivityId,
  type CoachingStyleId,
  type EnvironmentId,
  type EquipmentId,
  type GoalId,
  type UserProfile,
} from "@/lib/profile";

const GOAL_ICONS: Record<GoalId, LucideIcon> = {
  strength: Dumbbell,
  "weight-loss": Flame,
  endurance: HeartPulse,
  mobility: PersonStanding,
  general: Sparkles,
};

const ACTIVITY_ICONS: Record<ActivityId, LucideIcon> = {
  running: Footprints,
  walking: Footprints,
  cycling: Bike,
  weightlifting: Dumbbell,
  bodyweight: PersonStanding,
  swimming: Waves,
  yoga: Flower2,
  hiit: Zap,
};

const ENVIRONMENT_ICONS: Record<EnvironmentId, LucideIcon> = {
  gym: Building2,
  home: Home,
  outdoors: Trees,
  travel: Luggage,
};

const STEPS = [
  "About you",
  "Your goal",
  "Your activities",
  "Where you train",
] as const;

interface OnboardingWizardProps {
  initialProfile?: UserProfile | null;
  displayName?: string | null;
  onComplete: (profile: UserProfile) => void;
}

/**
 * Profile setup.
 *
 * Step 4 captures where the user trains and what they can train with —
 * the difference between a plan they can follow and one they can't.
 * It is SKIPPABLE: a blocked signup costs more than an imperfect plan,
 * and the coach can ask conversationally later.
 *
 * Equipment is only asked when it would tell us something. Someone who
 * trains exclusively at a commercial gym has access to everything, so
 * inventorying it is busywork.
 */
export function OnboardingWizard({
  initialProfile,
  displayName,
  onComplete,
}: OnboardingWizardProps) {
  const prefersReducedMotion = useReducedMotion();
  const isEditing = Boolean(initialProfile);

  const [showIntro, setShowIntro] = useState(!isEditing);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const [firstName, setFirstName] = useState(initialProfile?.firstName ?? "");
  const [age, setAge] = useState(
    initialProfile ? String(initialProfile.age) : "",
  );
  const [weight, setWeight] = useState(
    initialProfile ? String(initialProfile.weightKg) : "",
  );
  const [height, setHeight] = useState(
    initialProfile?.heightCm ? String(initialProfile.heightCm) : "",
  );
  const [goal, setGoal] = useState<GoalId | null>(initialProfile?.goal ?? null);
  const [activities, setActivities] = useState<ActivityId[]>(
    initialProfile?.activities ?? [],
  );
  const [environment, setEnvironment] = useState<EnvironmentId[]>(
    initialProfile?.environment ?? [],
  );
  const [equipment, setEquipment] = useState<EquipmentId[]>(
    initialProfile?.equipment ?? [],
  );
  const [coachingStyle, setCoachingStyle] = useState<CoachingStyleId | null>(
    initialProfile?.coachingStyle ?? null,
  );

  // ── Validation ────────────────────────────────────────────────────
  const parsedAge = Number(age);
  const parsedWeight = Number(weight);
  const parsedHeight = Number(height);
  const heightValid =
    height.trim() === "" ||
    (Number.isFinite(parsedHeight) &&
      parsedHeight >= 100 &&
      parsedHeight <= 250);

  const basicsValid =
    firstName.trim().length >= 2 &&
    Number.isFinite(parsedAge) &&
    parsedAge >= 13 &&
    parsedAge <= 100 &&
    Number.isFinite(parsedWeight) &&
    parsedWeight >= 30 &&
    parsedWeight <= 300 &&
    heightValid;

  // Step 4 is always "valid" — it can be skipped entirely.
  const stepValid = [basicsValid, goal !== null, activities.length > 0, true][
    step
  ];

  const askEquipment =
    environment.length > 0 && needsEquipmentQuestion(environment);

  // ── Navigation ────────────────────────────────────────────────────
  function goForward() {
    if (!stepValid) return;
    track("onboarding_step_completed", {
      step: STEPS[step],
      step_index: step + 1,
      editing: isEditing,
    });
    if (step < STEPS.length - 1) {
      setDirection(1);
      setStep(step + 1);
      return;
    }
    finish();
  }

  function goBack() {
    if (step === 0) return;
    setDirection(-1);
    setStep(step - 1);
  }

  function finish() {
    if (environment.length === 0) {
      track("onboarding_skipped_setup");
    }
    track("onboarding_completed", {
      editing: isEditing,
      goal: goal ?? "unset",
      sessions_per_week: null,
      weight_provided: Boolean(parsedWeight),
      height_provided: Boolean(heightValid && height.trim()),
      // Counts only — never the values themselves.
      activity_count: activities.length,
      environment_count: environment.length,
      equipment_count: equipment.length,
      coaching_style: coachingStyle ?? "unset",
    });

    const now = new Date().toISOString();
    onComplete({
      firstName: firstName.trim(),
      age: parsedAge,
      weightKg: parsedWeight,
      ...(heightValid && height.trim() !== ""
        ? { heightCm: parsedHeight }
        : {}),
      goal: goal as GoalId,
      activities,
      ...(environment.length > 0 ? { environment } : {}),
      ...(equipment.length > 0 ? { equipment } : {}),
      ...(coachingStyle ? { coachingStyle } : {}),
      createdAt: initialProfile?.createdAt ?? now,
      updatedAt: now,
    });
  }

  function toggleActivity(id: ActivityId) {
    setActivities((prev) =>
      prev.includes(id)
        ? prev.filter((activity) => activity !== id)
        : [...prev, id],
    );
  }

  function toggleEnvironment(id: EnvironmentId) {
    setEnvironment((prev) =>
      prev.includes(id)
        ? prev.filter((environmentId) => environmentId !== id)
        : [...prev, id],
    );
  }

  function toggleEquipment(id: EquipmentId) {
    setEquipment((prev) => {
      // "Nothing" is exclusive — it can't coexist with kit.
      if (id === "none") return prev.includes("none") ? [] : ["none"];
      const withoutNone = prev.filter((item) => item !== "none");
      return withoutNone.includes(id)
        ? withoutNone.filter((item) => item !== id)
        : [...withoutNone, id];
    });
  }

  // The activation funnel starts here. Recording which STEP people
  // reach is what turns "onboarding is leaky" into "40% die on step 2".
  useEffect(() => {
    if (showIntro) return;
    // Paired with step_completed, this is what turns "onboarding is
    // leaky" into "40% of people who SEE step 3 never finish it".
    track("onboarding_step_viewed", {
      step: STEPS[step],
      step_index: step + 1,
      editing: isEditing,
    });
  }, [showIntro, step, isEditing]);

  const stepMotion = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, x: 28 * direction },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -28 * direction },
        transition: { duration: 0.22, ease: "easeOut" as const },
      };

  // ── Intro (first-time users only) ─────────────────────────────────
  if (showIntro) {
    const greetingName = displayName?.split(" ")[0];

    return (
      <Card className="mx-auto w-full max-w-xl border-white/[0.07] bg-[#14161A] text-white shadow-none">
        <CardContent className="space-y-7 p-6 md:p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.07]">
              <Sparkles className="size-6 text-[#CCFF00]" strokeWidth={2} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-white">
                {greetingName
                  ? `Let's set you up, ${greetingName}.`
                  : "Let's set you up."}
              </h2>
              <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/60">
                A few short questions. Your answers shape every plan your
                coach writes — this is what makes the advice yours rather
                than generic.
              </p>
            </div>
          </div>

          <ul className="space-y-3">
            <IntroPoint
              icon={PersonStanding}
              title="Your basics"
              description="Age and weight let your coach calibrate training loads safely."
            />
            <IntroPoint
              icon={Flame}
              title="Your goal"
              description="Strength, weight loss, endurance — this sets the whole direction."
            />
            <IntroPoint
              icon={MapPin}
              title="Where you train"
              description="Gym, home, or on the road — so you never get prescribed kit you don't have."
            />
          </ul>

          <Button
            onClick={() => setShowIntro(false)}
            className="w-full gap-2 rounded-full bg-[#CCFF00] py-6 text-sm font-semibold text-black shadow-[0_10px_40px_-12px_rgba(204,255,0,0.5)] hover:bg-[#d9ff33] active:scale-[0.99]"
          >
            Get started
            <ArrowRight className="size-4" />
          </Button>

          <p className="text-center font-mono text-[10px] uppercase tracking-[0.1em] text-white/50">
            Takes about a minute. You can change any of it later.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Wizard ────────────────────────────────────────────────────────
  return (
    <Card className="mx-auto w-full max-w-xl border-white/[0.07] bg-[#14161A] text-white shadow-none">
      <CardContent className="p-6 md:p-8">
        {/* Progress */}
        <div className="mb-8 space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
              Step {step + 1} / {STEPS.length}
            </p>
            <p className="text-sm font-medium text-white/70">{STEPS[step]}</p>
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((label, index) => (
              <div
                key={label}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors duration-300",
                  index <= step ? "bg-[#CCFF00]" : "bg-white/[0.08]",
                )}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} {...stepMotion}>
            {step === 0 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label
                    htmlFor="firstName"
                    className="text-sm font-medium text-white/70"
                  >
                    First name
                  </label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="What should your coach call you?"
                    autoComplete="given-name"
                    className="h-11 rounded-xl border-white/[0.07] bg-black/50 px-4 text-white placeholder:text-white/50 focus-visible:border-[#CCFF00]/60 focus-visible:bg-black/70 focus-visible:ring-0"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <label
                      htmlFor="age"
                      className="text-sm font-medium text-white/70"
                    >
                      Age
                    </label>
                    <Input
                      id="age"
                      type="number"
                      inputMode="numeric"
                      min={13}
                      max={100}
                      value={age}
                      onChange={(event) => setAge(event.target.value)}
                      placeholder="e.g. 32"
                      className="h-11 rounded-xl border-white/[0.07] bg-black/50 px-4 text-white placeholder:text-white/50 focus-visible:border-[#CCFF00]/60 focus-visible:bg-black/70 focus-visible:ring-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="weight"
                      className="text-sm font-medium text-white/70"
                    >
                      Weight (kg)
                    </label>
                    <Input
                      id="weight"
                      type="number"
                      inputMode="decimal"
                      min={30}
                      max={300}
                      value={weight}
                      onChange={(event) => setWeight(event.target.value)}
                      placeholder="78"
                      className="h-11 rounded-xl border-white/[0.07] bg-black/50 px-4 text-white placeholder:text-white/50 focus-visible:border-[#CCFF00]/60 focus-visible:bg-black/70 focus-visible:ring-0"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="height"
                      className="text-sm font-medium text-white/70"
                    >
                      Height (cm)
                    </label>
                    <Input
                      id="height"
                      type="number"
                      inputMode="numeric"
                      min={100}
                      max={250}
                      value={height}
                      onChange={(event) => setHeight(event.target.value)}
                      placeholder="175"
                      className="h-11 rounded-xl border-white/[0.07] bg-black/50 px-4 text-white placeholder:text-white/50 focus-visible:border-[#CCFF00]/60 focus-visible:bg-black/70 focus-visible:ring-0"
                    />
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-white/50">
                  Used to calibrate training loads and progression. Height is
                  optional. Nothing here is ever shown to anyone else, and
                  AdimFit will not score or judge your body.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-white/60">
                  What matters most to you right now? Pick one — you can
                  change it anytime.
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {GOALS.map(({ id, label }) => {
                    const Icon = GOAL_ICONS[id];
                    const selected = goal === id;
                    return (
                      <SelectTile
                        key={id}
                        icon={Icon}
                        label={label}
                        selected={selected}
                        onClick={() => setGoal(id)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-white/60">
                  Which activities do you enjoy? Select all that apply —
                  your plans will lean on these.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {ACTIVITIES.map(({ id, label }) => (
                    <SelectTile
                      key={id}
                      icon={ACTIVITY_ICONS[id]}
                      label={label}
                      selected={activities.includes(id)}
                      onClick={() => toggleActivity(id)}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white/70">
                      Where do you usually train?
                    </p>
                    <p className="text-sm leading-relaxed text-white/60">
                      Select all that apply. Your coach won&apos;t prescribe
                      a barbell session if you&apos;re in a hotel room.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {ENVIRONMENTS.map(({ id, label }) => (
                      <SelectTile
                        key={id}
                        icon={ENVIRONMENT_ICONS[id]}
                        label={label}
                        selected={environment.includes(id)}
                        onClick={() => toggleEnvironment(id)}
                        compact
                      />
                    ))}
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {askEquipment && (
                    <motion.div
                      initial={
                        prefersReducedMotion
                          ? false
                          : { opacity: 0, height: 0 }
                      }
                      animate={{ opacity: 1, height: "auto" }}
                      exit={
                        prefersReducedMotion
                          ? { opacity: 0 }
                          : { opacity: 0, height: 0 }
                      }
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 border-t border-white/[0.06] pt-6">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-white/70">
                            What do you have access to?
                          </p>
                          <p className="text-sm leading-relaxed text-white/60">
                            Outside the gym, this is what shapes your
                            sessions.
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {EQUIPMENT.map(({ id, label }) => {
                            const selected = equipment.includes(id);
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => toggleEquipment(id)}
                                aria-pressed={selected}
                                className={cn(
                                  "rounded-full border px-3.5 py-2 text-sm font-medium outline-none transition-all active:scale-[0.98]",
                                  "focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50",
                                  selected
                                    ? "border-[#CCFF00]/40 bg-[#CCFF00]/[0.08] text-white"
                                    : "border-white/[0.07] bg-black/30 text-white/60 hover:border-white/15 hover:text-white",
                                )}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4 border-t border-white/[0.06] pt-6">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white/80">
                      How should your coach talk to you?
                    </p>
                    <p className="text-sm leading-relaxed text-white/60">
                      Same programming either way — only the delivery
                      changes.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {COACHING_STYLES.map(({ id, label, description }) => {
                      const selected = coachingStyle === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() =>
                            setCoachingStyle(selected ? null : id)
                          }
                          aria-pressed={selected}
                          className={cn(
                            "w-full rounded-xl border px-4 py-3 text-left outline-none transition-all active:scale-[0.99]",
                            "focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50",
                            selected
                              ? "border-[#CCFF00]/40 bg-[#CCFF00]/[0.08]"
                              : "border-white/[0.07] bg-black/30 hover:border-white/15",
                          )}
                        >
                          <span
                            className={cn(
                              "block text-sm font-medium",
                              selected ? "text-white" : "text-white/70",
                            )}
                          >
                            {label}
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-white/50">
                            {description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-white/50">
                  All optional — skip and tell your coach in chat instead. It
                  also adapts per session: say &ldquo;I&apos;m travelling
                  today&rdquo; and the plan changes.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer navigation */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={step === 0}
            className={cn(
              "gap-2 text-white/60 hover:bg-white/[0.04] hover:text-white",
              step === 0 && "invisible",
            )}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            {step === STEPS.length - 1 &&
              environment.length === 0 &&
              !coachingStyle && (
              <Button
                variant="ghost"
                onClick={finish}
                className="text-white/50 hover:bg-white/[0.04] hover:text-white/70"
              >
                  Skip
                </Button>
              )}

            <Button
              onClick={goForward}
              disabled={!stepValid}
              className="gap-2 rounded-full bg-[#CCFF00] px-6 font-semibold text-black shadow-[0_10px_30px_-12px_rgba(204,255,0,0.5)] hover:bg-[#d9ff33] active:scale-[0.99] disabled:opacity-30 disabled:shadow-none"
            >
              {step === STEPS.length - 1
                ? isEditing
                  ? "Save changes"
                  : "Finish setup"
                : "Continue"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SelectTile({
  icon: Icon,
  label,
  selected,
  onClick,
  compact = false,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-3 rounded-xl border text-left font-medium outline-none transition-all",
        "focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 active:scale-[0.99]",
        compact ? "gap-2.5 px-3.5 py-3 text-sm" : "px-4 py-3.5 text-sm",
        selected
          ? "border-[#CCFF00]/40 bg-[#CCFF00]/[0.08] text-white"
          : "border-white/[0.07] bg-black/30 text-white/60 hover:border-white/15 hover:text-white",
      )}
    >
      <Icon
        className={cn(
          "shrink-0",
          compact ? "size-4" : "size-5",
          selected ? "text-[#CCFF00]" : "text-white/50",
        )}
        strokeWidth={2}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected && !compact && (
        <Check className="size-4 shrink-0 text-[#CCFF00]" strokeWidth={2.5} />
      )}
    </button>
  );
}

function IntroPoint({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <li className="flex items-start gap-3.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-black/30">
        <Icon className="size-4 text-white/40" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-white/60">
          {description}
        </p>
      </div>
    </li>
  );
}