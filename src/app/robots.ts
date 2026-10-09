// src/app/robots.ts
import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

/**
 * ── WHO IS ALLOWED TO READ THIS SITE ────────────────────────────────
 * Two audiences, deliberately separated.
 *
 * SEARCH AND ANSWER ENGINES ARE WELCOME. GPTBot, OAI-SearchBot,
 * PerplexityBot and ClaudeBot are how a person asking an assistant
 * "what's a good alternative to a personal trainer" ever hears this
 * product named. Blocking them — the reflexive move — buys nothing
 * and costs the only distribution channel that is still cheap.
 *
 * `Google-Extended` is listed explicitly because it is NOT a crawler.
 * It is a training-data opt-out token, and leaving it unmentioned is
 * read as consent by omission. It is stated here so the answer is on
 * the record either way.
 *
 * CCBot IS BLOCKED. Common Crawl is a bulk archive, not a referrer:
 * nothing it collects sends a reader back, and its corpus is resold
 * into datasets this site gets nothing from. The distinction is not
 * "AI good, AI bad" — it is whether a bot's visit can ever result in
 * someone arriving.
 *
 * THE APP ITSELF IS DISALLOWED. `/today`, `/coach`, `/log` and the
 * rest render nothing without a session, so a crawler that follows
 * them indexes a loading splash under a URL that will never show a
 * stranger anything. `/p/` holds near-identical per-partner landing
 * pages, which is textbook thin content.
 *
 * DISALLOW IS NOT SECURITY. It keeps well-behaved crawlers out of
 * pages that are useless to them. Everything private is private
 * because of Firestore rules and server-side entitlement checks, not
 * because of this file.
 * ─────────────────────────────────────────────────────────────────────
 */

const PRIVATE_PATHS = [
  "/today",
  "/coach",
  "/log",
  "/profile",
  "/progress",
  "/billing",
  "/partners",
  "/api/",
  "/p/",
  "/r/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        // Answer engines: the ones that can actually send a reader.
        userAgent: [
          "Googlebot",
          "Bingbot",
          "GPTBot",
          "ChatGPT-User",
          "OAI-SearchBot",
          "PerplexityBot",
          "ClaudeBot",
          "Claude-User",
          "anthropic-ai",
          "Google-Extended",
          "Applebot",
          "Applebot-Extended",
        ],
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        // Bulk archival with no path back to the site.
        userAgent: "CCBot",
        disallow: "/",
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
