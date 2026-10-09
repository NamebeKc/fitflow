// src/components/marketing/SignedInRedirect.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { useAuth } from "@/components/providers/AuthProvider";

/**
 * ── SENDING SIGNED-IN PEOPLE HOME ───────────────────────────────────
 * `/` is now the public marketing page and the dashboard lives at
 * `/today`. Someone with a session who opens the bare domain should
 * land in the product, not on a pitch for something they already pay
 * for.
 *
 * WHY THIS RENDERS NOTHING ON THE SERVER. Firebase resolves auth in
 * the browser; there is no session cookie to read during SSR. If this
 * component returned a splash on the server, every crawler would
 * receive a page whose entire content sat underneath a full-screen
 * overlay — which is precisely the cloaking pattern the restructure
 * exists to eliminate. So it waits for `mounted`, and the HTML source
 * stays exactly what a reader sees.
 *
 * The consequence is a brief flash of the landing page for signed-in
 * users while Firebase resolves. That is the honest cost of
 * client-side auth, and it is the smaller of the two evils.
 * ─────────────────────────────────────────────────────────────────────
 */
export function SignedInRedirect() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isLoading && user) router.replace("/today");
  }, [isLoading, user, router]);

  if (!mounted || isLoading || !user) return null;

  // Only ever seen post-hydration, by someone already signed in, for
  // the moment between the decision and the navigation. Matching the
  // app's base colour is what prevents a white flash mid-transition.
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#090A0C]">
      <Image
        src="/logo-lockup.png"
        alt="AdimFit"
        width={520}
        height={429}
        className="h-24 w-auto animate-pulse"
      />
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/30">
        Opening your dashboard
      </p>
    </div>
  );
}
