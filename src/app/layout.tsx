// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

import { AnalyticsProvider } from "@/components/providers/AnalyticsProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ProfileProvider } from "@/components/providers/ProfileProvider";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

/**
 * FONTS ARE NOT LOADED HERE. They are @font-face declarations in
 * globals.css, self-hosted and subset from public/fonts.
 *
 * Geist was removed on 9 October 2026. Its cmap contains no NAIRA
 * SIGN (U+20A6), so every price on the site was rendering its
 * currency symbol in a browser fallback; it also lacks the Yoruba
 * s-dot-below and the Igbo n-dot-above. See design.md section 4.2.2.
 */

export const metadata: Metadata = {
  // Resolves every relative URL in page-level metadata — canonicals,
  // Open Graph images — against the apex domain. Without it Next
  // emits relative OG URLs, which several crawlers simply drop.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AdimFit — AI Fitness Coach",
    template: "%s · AdimFit",
  },
  description: SITE_DESCRIPTION,
  applicationName: "AdimFit",
  appleWebApp: {
    // iOS ignores the web manifest entirely and reads these instead.
    capable: true,
    title: "AdimFit",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Matches --paper. The browser chrome should not be a different
  // colour from the page it frames.
  themeColor: "#FAF7F3",
};

/**
 * ── ROOT LAYOUT ─────────────────────────────────────────────────────
 * Deliberately thin: fonts, providers, service worker, analytics.
 *
 * Routes are split by route group:
 *   (app)   → sidebar + AuthGate. The product.
 *   (legal) → bare page. Public, because policy documents must be
 *             readable without an account.
 *
 * AnalyticsProvider sits INSIDE AuthProvider so it can react to
 * sign-in and sign-out.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className="min-h-dvh bg-paper font-sans text-ink antialiased selection:bg-indigo-wash selection:text-ink"
      >
        <ServiceWorkerRegistrar />

        <AuthProvider>
          <AnalyticsProvider />
          <ProfileProvider>{children}</ProfileProvider>
        </AuthProvider>
      </body>
    </html>
  );
}