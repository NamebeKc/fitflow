// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AnalyticsProvider } from "@/components/providers/AnalyticsProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ProfileProvider } from "@/components/providers/ProfileProvider";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "AdimFit — AI Fitness Coach",
  description:
    "A coach that remembers every session. Adaptive training built from your own history.",
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
  themeColor: "#090A0C",
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body
        suppressHydrationWarning
        className="min-h-dvh bg-[#090A0C] font-sans text-white antialiased selection:bg-[#CCFF00] selection:text-black"
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