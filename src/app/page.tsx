// src/app/page.tsx
import type { Metadata } from "next";

import { LandingPage } from "@/components/marketing/LandingPage";
import { SignedInRedirect } from "@/components/marketing/SignedInRedirect";
import { resolveHeadline } from "@/components/marketing/headlines";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/site";

/**
 * ── THE PUBLIC HOMEPAGE ─────────────────────────────────────────────
 * Deliberately OUTSIDE the `(app)` route group, so it inherits none
 * of the product's gates. Nothing here waits on Firebase, and nothing
 * here needs a session.
 *
 * `searchParams` is a promise in Next 16 and awaiting it opts this
 * route into dynamic rendering — which is exactly what the `?v=`
 * headline test requires. The variant is chosen on the SERVER and
 * rendered into the HTML, so a crawler following a campaign link sees
 * the same headline a person does. The previous implementation
 * applied it in `useEffect`, which meant the variants were invisible
 * to everything that does not run JavaScript.
 * ─────────────────────────────────────────────────────────────────────
 */

export const metadata: Metadata = {
  title: "AdimFit — an AI fitness coach that remembers every session",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "AdimFit — an AI fitness coach that remembers every session",
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    images: [OG_IMAGE.url],
    title: "AdimFit — an AI fitness coach that remembers every session",
    description: SITE_DESCRIPTION,
  },
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[] }>;
}) {
  const { v } = await searchParams;

  return (
    <>
      <SignedInRedirect />
      <LandingPage variant={resolveHeadline(v)} />
    </>
  );
}
