// src/components/pwa/InstallPrompt.tsx
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, Share, SquarePlus, X } from "lucide-react";

import { track } from "@/lib/analytics";

/**
 * ── ADD TO HOME SCREEN ──────────────────────────────────────────────
 * Two completely different mechanisms hide behind one feature.
 *
 * Chrome / Edge / Android fire a `beforeinstallprompt` event, which we
 * capture and replay later from a button of our own — the browser's
 * default banner is easy to miss and impossible to style.
 *
 * iOS Safari fires nothing and offers no API. Installing there is
 * manual: Share → Add to Home Screen. All we can do is detect iOS and
 * show the instructions.
 *
 * Timing matters more than either. This appears only after the user
 * has been in the app a while — asking someone to install a product
 * they haven't used yet is how prompts get dismissed permanently.
 * ─────────────────────────────────────────────────────────────────────
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Remembers a dismissal so we don't nag on every visit. */
const DISMISSED_KEY = "adimfit:install-dismissed";
/** Delay before offering, in ms. */
const APPEAR_AFTER = 20_000;

export function InstallPrompt() {
  const prefersReducedMotion = useReducedMotion();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [isIOS, setIsIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed? Nothing to offer.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari's non-standard flag for home-screen launches.
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // Private browsing can throw on storage access — treat as not dismissed.
    }
    if (dismissed) return;

    const ios =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
      !/crios|fxios/i.test(window.navigator.userAgent);
    setIsIOS(ios);

    function onBeforeInstall(event: Event) {
      // Suppress the browser's own banner; we present it ourselves.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    const timer = window.setTimeout(() => {
      setVisible(true);
      track("pwa_install_prompt_shown", { platform: ios ? "ios" : "other" });
    }, APPEAR_AFTER);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    track("pwa_install_dismissed");
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Non-fatal.
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    track(
      choice.outcome === "accepted"
        ? "pwa_installed"
        : "pwa_install_dismissed",
    );
    setDeferred(null);
    setVisible(false);
  }

  // Nothing to show unless Chrome gave us a prompt, or we're on iOS
  // where instructions are the only option.
  const canOffer = Boolean(deferred) || isIOS;
  if (!visible || !canOffer) return null;

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 24 },
        transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <AnimatePresence>
      <motion.div
        {...motionProps}
        role="dialog"
        aria-label="Install AdimFit"
        className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-3xl border border-white/10 bg-[#14161A]/95 p-4 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl md:bottom-6 md:left-auto md:right-6 md:mx-0"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.07]">
            <Download className="size-5 text-[#CCFF00]" strokeWidth={2} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold tracking-[-0.01em] text-white">
              Add AdimFit to your home screen
            </p>

            {isIOS && !deferred ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-relaxed text-white/60">
                Tap
                <Share
                  className="inline size-3.5 text-white/70"
                  strokeWidth={2}
                />
                then
                <SquarePlus
                  className="inline size-3.5 text-white/70"
                  strokeWidth={2}
                />
                <span className="font-medium text-white/70">
                  Add to Home Screen
                </span>
              </p>
            ) : (
              <p className="mt-1 text-[13px] leading-relaxed text-white/60">
                Launches full screen, straight to your coach — no browser
                bar.
              </p>
            )}

            {!isIOS && deferred && (
              <button
                type="button"
                onClick={() => void install()}
                className="mt-3 w-full rounded-full bg-[#CCFF00] px-5 py-2.5 text-sm font-semibold text-black shadow-[0_10px_30px_-10px_rgba(204,255,0,0.5)] outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 active:scale-[0.99]"
              >
                Install
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-white/50 outline-none transition-colors hover:bg-white/[0.06] hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}