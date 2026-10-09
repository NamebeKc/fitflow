// src/components/auth/AuthGate.tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { useAuth } from "@/components/providers/AuthProvider";

/**
 * ── THE GATE ON THE PRODUCT ─────────────────────────────────────────
 * Wraps everything under the `(app)` route group.
 *
 * - Auth still resolving → obsidian splash with a pulsing indicator.
 *   Matching the app's base colour is what prevents the white flash
 *   that would otherwise precede a dark page.
 * - Signed out → sent to `/`, the public landing page.
 * - Signed in → children (sidebar + pages).
 *
 * WHY THIS NO LONGER RENDERS THE LANDING PAGE. It used to: `/` was the
 * dashboard, and a signed-out visitor got the marketing page returned
 * from inside this client component. That meant the homepage's entire
 * content existed only after hydration, and the HTML served to every
 * crawler was a logo and the word "Initializing" — the site had no
 * indexable content at all.
 *
 * The landing page is now a server component at `/`, the dashboard
 * moved to `/today`, and this gate does the one thing a gate should:
 * decide who gets through, and send everyone else somewhere sensible.
 * ─────────────────────────────────────────────────────────────────────
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/");
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-paper">
        <Image
          src="/logo-lockup.png"
          alt="AdimFit"
          width={520}
          height={429}
          priority
          className="h-24 w-auto animate-pulse"
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          Initializing
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
