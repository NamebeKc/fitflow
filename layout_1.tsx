// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Sidebar } from "@/components/layout/Sidebar";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Fitflow — AI Fitness Coach",
  description:
    "Personalized, data-driven workout coaching with conversational AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
        {/* Fixed sidebar lives outside the scroll container; main content is offset
            by the sidebar's width at each breakpoint (icon rail at md, full at lg).
            Below md the sidebar renders as a bottom tab bar, so we pad the bottom. */}
        <Sidebar />

        <main className="pb-24 md:pb-0 md:pl-[76px] lg:pl-64">
          <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10 lg:px-10">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
