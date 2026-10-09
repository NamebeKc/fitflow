// src/lib/site.ts

/**
 * ── ONE CANONICAL ORIGIN ────────────────────────────────────────────
 * Read by the landing page's structured data, `robots.ts`,
 * `sitemap.ts` and every canonical tag. A sitemap that advertises
 * `www.` while the canonical says apex is a split index, and it is
 * the kind of mistake that survives for months because nothing
 * visibly breaks.
 *
 * Apex, no trailing slash, https. `next.config.ts` 308s `www.` here.
 * ─────────────────────────────────────────────────────────────────────
 */
export const SITE_URL = "https://adimfit.com";

/**
 * Absolute URL for a site-relative path.
 *
 * The root is returned bare rather than with a trailing slash, so the
 * homepage has exactly one spelling everywhere it appears.
 */
export function absoluteUrl(path = "/"): string {
  if (path === "/" || path === "") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SITE_NAME = "AdimFit";

/**
 * Kept under 160 characters. Google truncates around there, and a
 * description that ends mid-clause reads as neglect in the one place a
 * stranger judges the site before clicking.
 */
export const SITE_DESCRIPTION =
  "An AI fitness coach that builds every session from your own training history. Log a workout in seconds and get a plan that adapts to the week you actually had.";

/**
 * ── THE SOCIAL CARD ─────────────────────────────────────────────────
 * 1200×630, the size every platform crops from. The site previously
 * declared `summary_large_image` while pointing at a 520×429 logo,
 * which renders badly or is dropped outright — a silent tax on every
 * share, and on every link an assistant surfaces with a preview.
 *
 * Defined once and spread into each page's `openGraph`, because Next
 * replaces the parent's `openGraph` object wholesale when a page
 * declares its own; inheriting it is not an option.
 */
export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "AdimFit — an AI fitness coach that remembers every session",
} as const;
