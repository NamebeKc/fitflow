// src/components/providers/AnalyticsProvider.tsx
"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useAuth } from "@/components/providers/AuthProvider";
import {
  identifyUser,
  initAnalytics,
  resetAnalytics,
  trackPageView,
} from "@/lib/analytics";
import { captureAttribution, claimAttribution } from "@/lib/attribution";

/**
 * Wires analytics into the app lifecycle.
 *
 * Renders nothing. It exists to run three side effects:
 *   1. Initialise PostHog once on the client.
 *   2. Record a page view on every route change — the App Router does
 *      client-side navigation, so the browser never fires a fresh page
 *      load and automatic tracking would miss almost everything.
 *   3. Identify on sign-in, reset on sign-out.
 *
 * The inner component reads search params, which Next.js requires to
 * sit inside a Suspense boundary; the wrapper provides it.
 */
export function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <AnalyticsTracker />
    </Suspense>
  );
}

function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const identifiedRef = useRef<string | null>(null);

  // Initialise once.
  useEffect(() => {
    initAnalytics();
    // Must run before any navigation away from the landing URL — the
    // campaign parameters only exist on that first request.
    captureAttribution();
  }, []);

  // Page view on every navigation.
  useEffect(() => {
    const query = searchParams.toString();
    trackPageView(query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);

  // Identity follows auth state.
  useEffect(() => {
    if (isLoading) return;

    if (user && identifiedRef.current !== user.uid) {
      identifyUser(user.uid);
      identifiedRef.current = user.uid;
      // Hand the stored referral to the server. The route writes once
      // per user, so running this on every sign-in costs nothing and
      // covers the case where a first attempt never landed.
      void user.getIdToken().then(claimAttribution);
      return;
    }

    if (!user && identifiedRef.current) {
      resetAnalytics();
      identifiedRef.current = null;
    }
  }, [user, isLoading]);

  return null;
}