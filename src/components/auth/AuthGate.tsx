// src/components/auth/AuthGate.tsx
"use client";

import type { ReactNode } from "react";
import Image from "next/image";

import { useAuth } from "@/components/providers/AuthProvider";
import { LandingPage } from "@/components/marketing/LandingPage";

/**
 * The front door.
 *
 * - Auth still resolving → obsidian splash with a pulsing indicator.
 *   Matching the landing page's base colour is what prevents the white
 *   flash that would otherwise precede a dark page.
 * - Signed out → the landing page, which owns its own auth actions.
 * - Signed in → children (sidebar + pages).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[#090A0C]">
        <Image
          src="/logo-lockup.png"
          alt="AdimFit"
          width={520}
          height={429}
          priority
          className="h-24 w-auto animate-pulse"
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/30">
          Initializing
        </p>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return <>{children}</>;
}