// src/components/marketing/ConversionCard.tsx
"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { track } from "@/lib/analytics";

/**
 * ── THE ONLY INTERACTIVE PART OF THE FRONT DOOR ─────────────────────
 * Extracted from LandingPage so the page around it can be a server
 * component. Everything here genuinely needs the browser — auth
 * calls, form state, an expanding panel — so this island keeps
 * Framer Motion and pays the JavaScript cost honestly.
 *
 * FASTEST PATH FIRST. Google sign-in is one tap; email is three
 * fields typed on a phone. Google leads, email is available for
 * those who want it.
 * ─────────────────────────────────────────────────────────────────────
 */
export function ConversionCard() {
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
            "This email signed up with Google. Use “Continue with Google” above.",
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
      className="rounded-lg border border-rule bg-paper-raised p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] sm:p-6"
    >
      {/* The one-tap path, given the most weight */}
      <button
        type="button"
        onClick={() => {
          track("signup_started", { method: "google" });
          void signInWithGoogle();
        }}
        className="flex w-full items-center justify-center gap-3 rounded-sm border border-field-border bg-paper-raised px-6 py-3.5 text-[15px] font-semibold text-ink outline-none transition-all hover:bg-paper-sunken focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:translate-y-px"
      >
        <GoogleMark />
        Continue with Google
      </button>

      <p className="mt-3 text-center text-[13px] text-ink-muted">
        Free to start · No card required
      </p>

      {/* Email, available but not in the way */}
      <div className="mt-6 border-t border-rule pt-4">
        <button
          type="button"
          onClick={() => setShowEmail((open) => !open)}
          aria-expanded={showEmail}
          className="flex w-full items-center justify-center gap-1.5 text-[13px] font-medium text-ink-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-moss"
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
                <div className="flex rounded-full bg-paper p-1">
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
                          active ? "text-on-lime" : "text-ink-muted hover:text-ink",
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
                            className="absolute inset-0 -z-10 rounded-full bg-lime"
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
                      className="text-[12px] text-ink-muted underline underline-offset-4 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-moss disabled:opacity-50"
                    >
                      {resetting ? "Sending…" : "Forgot your password?"}
                    </button>
                  </div>
                )}

                {error && (
                  <p
                    role="alert"
                    className="mt-3 rounded-md border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-200"
                  >
                    {error}
                  </p>
                )}

                {notice && (
                  <p
                    role="status"
                    className="mt-3 rounded-md border border-moss/25 bg-lime-wash px-3.5 py-2.5 text-[13px] leading-relaxed text-ink"
                  >
                    {notice}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-lime px-6 py-3 text-[14px] font-semibold text-on-lime outline-none transition-all hover:bg-lime-press focus-visible:ring-2 focus-visible:ring-moss active:translate-y-px disabled:opacity-50"
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
      <span className="text-[13px] font-medium text-ink-muted">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-md border border-rule bg-paper px-4 py-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-moss focus:bg-paper"
      />
    </label>
  );
}

/* ══ Custom glyphs ════════════════════════════════════════════════ */
/* Drawn rather than pulled from an icon library — a default icon set
   is one of the clearest tells that a product was assembled from a
   template. */

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
