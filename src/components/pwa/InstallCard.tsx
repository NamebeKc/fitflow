// src/components/pwa/InstallCard.tsx
"use client";

import { useEffect, useState } from "react";
import { Check, Download, Share, SquarePlus } from "lucide-react";

import { track } from "@/lib/analytics";

/**
 * ── A PERMANENT WAY TO INSTALL ──────────────────────────────────────
 * The timed prompt is not enough, and a user told us so: he asked for
 * "an app" when installability had already shipped.
 *
 * The prompt waits twenty seconds, appears once, and remembers a
 * dismissal forever. Every one of those choices is defensible on its
 * own — together they mean most people never learn the feature exists.
 * A prompt is a nudge; this is the place you go when you've decided
 * you want it.
 *
 * On Chrome and Android it replays the captured `beforeinstallprompt`.
 * On iOS, where no such API exists, it shows the manual steps — which
 * is the only honest option, since Safari installs are entirely
 * user-driven.
 * ─────────────────────────────────────────────────────────────────────
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallCard() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (standalone) {
      setInstalled(true);
      return;
    }

    setIsIOS(
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
        !/crios|fxios/i.test(window.navigator.userAgent),
    );

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  async function install() {
    if (!deferred || busy) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      track(
        choice.outcome === "accepted" ? "pwa_installed" : "pwa_install_dismissed",
        { trigger: "profile_card" },
      );
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } finally {
      setBusy(false);
    }
  }

  if (installed) {
    return (
      <section className="flex items-center gap-3 rounded-3xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.04] p-5">
        <Check className="size-4 shrink-0 text-[#CCFF00]" strokeWidth={3} />
        <p className="text-sm text-white/70">
          AdimFit is installed on this device.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Download className="size-4 text-[#CCFF00]" strokeWidth={2} />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          Install
        </p>
      </div>

      <p className="mt-3 text-lg font-semibold tracking-[-0.02em] text-white">
        Put AdimFit on your home screen
      </p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-white/60">
        Opens full screen with no browser bar, straight to your coach —
        the same as any other app on your phone.
      </p>

      {isIOS && !deferred ? (
        <ol className="mt-5 space-y-2.5">
          <IOSStep n="1">
            Tap the <Share className="inline size-3.5 align-[-2px]" /> Share
            button in Safari&apos;s toolbar
          </IOSStep>
          <IOSStep n="2">
            Scroll down and choose{" "}
            <SquarePlus className="inline size-3.5 align-[-2px]" />{" "}
            <span className="font-medium text-white/80">Add to Home Screen</span>
          </IOSStep>
          <IOSStep n="3">Tap Add. The icon appears with your other apps.</IOSStep>
        </ol>
      ) : (
        <button
          type="button"
          onClick={() => void install()}
          disabled={!deferred || busy}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-5 py-3 text-sm font-semibold text-black outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 active:scale-[0.99] disabled:opacity-40"
        >
          <Download className="size-4" strokeWidth={2.5} />
          {deferred ? "Install AdimFit" : "Open in Chrome to install"}
        </button>
      )}

      {!isIOS && !deferred && (
        <p className="mt-3 text-center text-[12px] leading-relaxed text-white/50">
          Your browser hasn&apos;t offered installation yet. It usually
          appears after a few visits, or use Chrome&apos;s menu → Add to
          Home screen.
        </p>
      )}
    </section>
  );
}

function IOSStep({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-white/15 font-mono text-[10px] text-white/60">
        {n}
      </span>
      <span className="text-[13px] leading-relaxed text-white/60">
        {children}
      </span>
    </li>
  );
}