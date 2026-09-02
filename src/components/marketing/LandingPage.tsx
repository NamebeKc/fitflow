// src/components/marketing/LandingPage.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { readFirstTouch, setFirstTouch, track } from "@/lib/analytics";
import { HeroVideo } from "@/components/marketing/HeroVideo";
import { FeatureSection } from "@/components/marketing/FeatureSection";

/**
 * ── THE FRONT DOOR ──────────────────────────────────────────────────
 * Three principles, learned the hard way:
 *
 * 1. SHOW THE PRODUCT, NOT A FANTASY OF IT. The previous hero rendered
 *    a telemetry console — velocity index, strain, latency — none of
 *    which AdimFit measures. It looked impressive and promised a
 *    different product than the one people would get. What replaced it
 *    demonstrates the one thing AdimFit genuinely does that a generic
 *    chatbot cannot: answer from your own logged history.
 *
 * 2. FASTEST PATH FIRST. Google sign-in is one tap; email is three
 *    fields typed on a phone. Google leads, email is available for
 *    those who want it.
 *
 * 3. COPY STATES THE BENEFIT. Not the vibe.
 * ─────────────────────────────────────────────────────────────────────
 */

interface Headline {
  eyebrow: string;
  title: string;
  emphasis: string;
  subtitle: string;
}

const HEADLINES: Record<string, Headline> = {
  default: {
    eyebrow: "A dị m — I am",
    title: "A coach that remembers",
    emphasis: "every session.",
    subtitle:
      "Log a workout in three taps. Ask what's next. AdimFit builds each plan from what you've actually done — never from a template.",
  },
  price: {
    eyebrow: "AI personal training",
    title: "A personal trainer for",
    emphasis: "less than a coffee.",
    subtitle:
      "One hour with a PT costs more than a year of AdimFit. Same adaptive programming, available at 5am, and it remembers everything you've done.",
  },
  simple: {
    eyebrow: "AI personal training",
    title: "Log it. Ask it.",
    emphasis: "Get stronger.",
    subtitle:
      "Three taps to record a session. One question to know what's next. Your coach handles the rest.",
  },
};

export function LandingPage() {
  const prefersReducedMotion = useReducedMotion();
  const [headline, setHeadline] = useState<Headline>(HEADLINES.default);

  useEffect(() => {
    const variant = new URLSearchParams(window.location.search).get("v");
    if (variant && HEADLINES[variant]) setHeadline(HEADLINES[variant]);

    // Attribution is recorded ONCE per person. Overwriting it on a
    // later visit would credit whichever channel they happened to
    // return through, destroying the answer to "what brought them in".
    const touch = readFirstTouch();
    setFirstTouch(touch);

    track("landing_page_viewed", {
      hero_variant: touch.hero_variant ?? "default",
      utm_source: touch.utm_source,
      utm_medium: touch.utm_medium,
      utm_campaign: touch.utm_campaign,
      referral_code: touch.referral_code,
    });

    // Channel A's minimum viable test: a code in the URL plus a funnel
    // breakdown gives per-trainer signups without a trainer dashboard.
    if (touch.referral_code) {
      track("referral_link_clicked", { coach_slug: touch.referral_code });
    }
  }, []);

  const rise = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#090A0C] text-white antialiased">
      <div className="relative">
        {/* ── Hero ────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Sits behind everything in this band. The poster is the LCP
              element; the video only loads when motion, data, and
              connection all allow it. */}
          <HeroVideo />

          <div className="relative">
            <NavBar />
          </div>

          <div className="relative mx-auto w-full max-w-[1180px] px-5 pb-16 pt-6 md:px-8 md:pb-24 md:pt-10">
            <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-16">
              <div>
                <motion.div {...rise(0)}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#CCFF00]">
                    {headline.eyebrow}
                  </p>

                  <h1 className="mt-6 text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.035em] sm:text-[3.25rem] lg:text-[3.6rem]">
                    {headline.title}{" "}
                    <span className="text-[#CCFF00]">{headline.emphasis}</span>
                  </h1>

                  <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/70">
                    {headline.subtitle}
                  </p>
                </motion.div>

                <motion.div {...rise(0.12)} className="mt-9">
                  <ConversionCard />
                </motion.div>
              </div>

              <motion.div {...rise(0.26)} className="lg:pt-4">
                <MemoryProof reduced={Boolean(prefersReducedMotion)} />
              </motion.div>
            </div>
          </div>
        </section>

        <FeatureSection />
        <WhyDifferent />
        <PricingBand />
        <Footer />
      </div>
    </div>
  );
}

/* ══ Navigation ═══════════════════════════════════════════════════ */

function NavBar() {
  return (
    <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 md:px-8">
      <Image
        src="/logo-horizontal.png"
        alt="AdimFit"
        width={1646}
        height={430}
        priority
        className="h-10 w-auto sm:h-12"
      />

      <a
        href="#auth"
        className="rounded-full border border-white/12 px-4 py-2 text-[13px] font-medium text-white/70 outline-none transition-colors hover:border-[#CCFF00]/40 hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
      >
        Sign in
      </a>
    </header>
  );
}

/* ══ Conversion card — Google first ═══════════════════════════════ */

function ConversionCard() {
  const {
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    sendPasswordReset,
    checkSignInMethods,
  } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  const [showEmail, setShowEmail] = useState(false);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  const isRegister = mode === "register";

  async function submit() {
    if (busy) return;
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter an email and password to continue.");
      return;
    }

    setBusy(true);
    setNotice(null);
    if (isRegister) track("signup_started", { method: "email" });

    const message = isRegister
      ? await signUpWithEmail(email, password, name)
      : await signInWithEmail(email, password);
    setBusy(false);

    if (message) {
      // The commonest sign-in failure isn't a wrong password — it's an
      // account created with Google being offered a password form. Say
      // so rather than repeating "incorrect" at someone whose password
      // was never going to work.
      if (!isRegister) {
        const methods = await checkSignInMethods(email);
        if (methods.includes("google.com") && !methods.includes("password")) {
          setError(
            "This email signed up with Google. Use \u201cContinue with Google\u201d above.",
          );
          return;
        }
      }
      setError(message);
      return;
    }

    track(isRegister ? "signup_completed" : "signin_completed", {
      method: "email",
    });
  }

  async function resetPassword() {
    if (resetting) return;

    if (!email.trim()) {
      setError("Enter your email address first, then tap reset.");
      return;
    }

    setResetting(true);
    setError(null);
    setNotice(null);

    const message = await sendPasswordReset(email);
    setResetting(false);

    if (message) {
      setError(message);
      return;
    }

    track("password_reset_requested");
    setNotice(
      "If that email has a password account, a reset link is on its way. Check spam too.",
    );
  }

  return (
    <div
      id="auth"
      className="rounded-3xl border border-white/10 bg-[#14161A] p-5 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] sm:p-6"
    >
      {/* The one-tap path, given the most weight */}
      <button
        type="button"
        onClick={() => {
          track("signup_started", { method: "google" });
          void signInWithGoogle();
        }}
        className="flex w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3.5 text-[15px] font-semibold text-[#14161A] shadow-[0_10px_30px_-12px_rgba(255,255,255,0.4)] outline-none transition-all hover:bg-white/92 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#14161A] active:scale-[0.99]"
      >
        <GoogleMark />
        Continue with Google
      </button>

      <p className="mt-3 text-center text-[13px] text-white/50">
        Free to start · No card required
      </p>

      {/* Email, available but not in the way */}
      <div className="mt-5 border-t border-white/[0.07] pt-4">
        <button
          type="button"
          onClick={() => setShowEmail((open) => !open)}
          aria-expanded={showEmail}
          className="flex w-full items-center justify-center gap-1.5 text-[13px] font-medium text-white/50 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
        >
          {showEmail ? "Hide email options" : "Or use email instead"}
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              showEmail && "rotate-180",
            )}
            strokeWidth={2.5}
          />
        </button>

        <AnimatePresence initial={false}>
          {showEmail && (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }
              }
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="pt-4">
                <div className="flex rounded-full bg-black/50 p-1">
                  {(["register", "login"] as const).map((value) => {
                    const active = mode === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setMode(value);
                          setError(null);
                          track("auth_mode_switched", { to: value });
                        }}
                        className={cn(
                          "relative z-10 flex-1 rounded-full px-4 py-2 text-[13px] font-medium outline-none transition-colors",
                          active ? "text-black" : "text-white/50 hover:text-white/80",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="auth-mode-pill"
                            transition={
                              prefersReducedMotion
                                ? { duration: 0 }
                                : { type: "spring", stiffness: 420, damping: 34 }
                            }
                            className="absolute inset-0 -z-10 rounded-full bg-[#CCFF00]"
                            aria-hidden
                          />
                        )}
                        {value === "register" ? "Create account" : "Sign in"}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 space-y-3">
                  {isRegister && (
                    <Field
                      label="Name"
                      value={name}
                      onChange={setName}
                      placeholder="What should your coach call you?"
                      autoComplete="given-name"
                    />
                  )}
                  <Field
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@domain.com"
                    autoComplete="email"
                  />
                  <Field
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder={isRegister ? "At least 6 characters" : "••••••••"}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    onEnter={() => void submit()}
                  />
                </div>

                {!isRegister && (
                  <div className="mt-2.5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void resetPassword()}
                      disabled={resetting}
                      className="text-[12px] text-white/60 underline underline-offset-4 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 disabled:opacity-50"
                    >
                      {resetting ? "Sending…" : "Forgot your password?"}
                    </button>
                  </div>
                )}

                {error && (
                  <p
                    role="alert"
                    className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-200"
                  >
                    {error}
                  </p>
                )}

                {notice && (
                  <p
                    role="status"
                    className="mt-3 rounded-xl border border-[#CCFF00]/25 bg-[#CCFF00]/[0.07] px-3.5 py-2.5 text-[13px] leading-relaxed text-white/80"
                  >
                    {notice}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-5 py-3 text-[14px] font-semibold text-black outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 active:scale-[0.99] disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
                  ) : (
                    <>
                      {isRegister ? "Create account" : "Sign in"}
                      <ArrowRight className="size-4" strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  onEnter?: () => void;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-white/60">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-white/[0.09] bg-black/50 px-4 py-3 text-[15px] text-white outline-none transition-colors placeholder:text-white/50 focus:border-[#CCFF00]/60 focus:bg-black/70"
      />
    </label>
  );
}

/* ══ The proof — what makes this different ════════════════════════ */

/**
 * A coach answering from the user's own log.
 *
 * This is the entire pitch in one image: the chips are real entries,
 * the reply cites them by name. Anyone who has asked a general chatbot
 * for a workout plan recognises immediately what's missing there.
 */
function MemoryProof({ reduced }: { reduced: boolean }) {
  const step = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay, ease: "easeOut" as const },
        };

  return (
    <div className="rounded-3xl border border-white/[0.09] bg-[#14161A] p-5 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] sm:p-6">
      <motion.div {...step(0.35)}>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          Your last few sessions
        </p>
        <div className="mt-3 space-y-2">
          <LogRow day="Tue" activity="Walk" detail="32 min" />
          <LogRow day="Wed" activity="Push-ups & squats" detail="18 min" />
          <LogRow day="Thu" activity="Rest day" detail="—" muted />
        </div>
      </motion.div>

      <div className="my-5 h-px bg-white/[0.07]" />

      <div className="space-y-3.5">
        <motion.div {...step(0.6)} className="flex justify-end">
          <p className="max-w-[80%] rounded-2xl rounded-br-md bg-[#CCFF00] px-4 py-2.5 text-[15px] font-medium leading-relaxed text-black">
            What should I do today?
          </p>
        </motion.div>

        <motion.div {...step(0.9)} className="flex justify-start">
          <div className="max-w-[94%] rounded-2xl rounded-bl-md border border-white/[0.09] bg-[#1F2228] px-4 py-3.5 text-[15px] leading-relaxed text-white/80">
            <p>
              You walked Tuesday and did push-ups Wednesday, then rested
              yesterday — so your legs are fresh.
            </p>
            <p className="mt-2.5">
              25 minutes lower body. Squats{" "}
              <span className="font-mono text-[#CCFF00]">3 × 12</span>, up from
              your 3 × 10 last week.
            </p>
          </div>
        </motion.div>
      </div>

      <motion.p
        {...step(1.15)}
        className="mt-5 border-t border-white/[0.07] pt-4 text-center text-[13px] leading-relaxed text-white/50"
      >
        A general chatbot starts from zero every time.
        <br />
        <span className="text-white/70">AdimFit doesn&apos;t.</span>
      </motion.p>
    </div>
  );
}

function LogRow({
  day,
  activity,
  detail,
  muted = false,
}: {
  day: string;
  activity: string;
  detail: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/30 px-3.5 py-2.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/50">
        {day}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[14px]",
          muted ? "text-white/50" : "text-white/80",
        )}
      >
        {activity}
      </span>
      <span className="font-mono text-[12px] tabular-nums text-white/50">
        {detail}
      </span>
    </div>
  );
}

/* ══ How it works ═════════════════════════════════════════════════ */

function WhyDifferent() {
  const points = [
    "Adapts when you only have 20 minutes",
    "Works with a gym, dumbbells, or nothing at all",
    "Never prescribes kit you don't own",
    "Rest days don't break your streak",
  ];

  return (
    <section className="mx-auto w-full max-w-[1180px] px-5 py-16 md:px-8 md:py-20">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">
            Built for real weeks
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl">
            Life gets in the way.
            <span className="text-white/50"> Your plan shouldn&apos;t break.</span>
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/60">
            Most plans assume an ideal week that never happens. Tell your
            coach you&apos;re in a hotel with 20 minutes and it rebuilds the
            session — without losing your progress.
          </p>
        </div>

        <ul className="space-y-3">
          {points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 rounded-2xl border border-white/[0.09] bg-[#14161A] px-4 py-3.5"
            >
              <Check
                className="mt-0.5 size-4 shrink-0 text-[#CCFF00]"
                strokeWidth={3}
              />
              <span className="text-[15px] leading-relaxed text-white/70">
                {point}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ══ Pricing ══════════════════════════════════════════════════════ */

function PricingBand() {
  return (
    <section className="border-t border-white/[0.07]">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-16 md:px-8 md:py-20">
        <div className="overflow-hidden rounded-3xl border border-[#CCFF00]/20 bg-gradient-to-b from-[#CCFF00]/[0.07] to-transparent">
          <div className="flex flex-col gap-8 p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-md">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#CCFF00]">
                Simple pricing
              </p>
              <h2 className="mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-4xl">
                One plan. Cancel anytime.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-white/60">
                A single hour with a personal trainer costs more than a year
                of AdimFit.
              </p>
            </div>

            <div className="shrink-0">
              <p className="flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-[-0.04em]">
                  $7.99
                </span>
                <span className="text-[15px] text-white/50">/ month</span>
              </p>
              <p className="mt-1.5 font-mono text-[12px] text-[#CCFF00]">
                or $59.99 / year — save 37%
              </p>

              <a
                href="#auth"
                className="mt-6 flex items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-7 py-3.5 text-[15px] font-semibold text-black shadow-[0_10px_40px_-10px_rgba(204,255,0,0.5)] outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 active:scale-[0.99]"
              >
                Start free
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ══ Footer ═══════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="border-t border-white/[0.07]">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-5 py-10 md:flex-row md:items-start md:justify-between md:px-8">
        <div className="space-y-5">
          <Image
            src="/logo-horizontal.png"
            alt="AdimFit"
            width={1646}
            height={430}
            className="h-9 w-auto opacity-90"
          />
          <p className="max-w-xs text-[12px] leading-relaxed text-white/50">
            <span className="text-white/70">A dị m</span> — Igbo for
            &ldquo;I am&rdquo;. Fitness as something you become, not
            something you attempt.
          </p>

          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            <Link
              href="/privacy"
              className="text-[13px] text-white/50 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-[13px] text-white/50 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
            >
              Terms
            </Link>
          </nav>
        </div>

        <p className="max-w-md text-[12px] leading-relaxed text-white/50">
          AdimFit provides general fitness guidance and is not a substitute for
          medical advice. Consult a healthcare professional before starting a
          new exercise programme, particularly with an existing injury or
          medical condition.
        </p>
      </div>
    </footer>
  );
}

/* ══ Custom glyphs ════════════════════════════════════════════════ */
/* Drawn rather than pulled from an icon library — a default icon set
   is one of the clearest tells that a product was assembled from a
   template. These are geometric, share one stroke weight, and each
   depicts the actual step rather than a generic abstraction. */

function GoogleMark() {
  return (
    <svg className="size-[18px]" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.16 7.16 0 0 1 4.9 12c0-.8.14-1.57.37-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}