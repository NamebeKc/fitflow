// src/app/manifest.ts
import type { MetadataRoute } from "next";

/**
 * ── WEB APP MANIFEST ────────────────────────────────────────────────
 * Next.js serves this at /manifest.webmanifest and links it in <head>
 * automatically. Writing it as TypeScript rather than a static JSON
 * file means the shape is type-checked at build time.
 *
 * A browser will only offer "Add to Home Screen" when three things are
 * true: this manifest exists with name/icons/start_url/display, at
 * least one 192px and one 512px icon are reachable, and a service
 * worker with a fetch handler is registered. All three ship together —
 * two out of three offers nothing.
 * ─────────────────────────────────────────────────────────────────────
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AdimFit — AI Fitness Coach",
    // Home-screen labels truncate around 12 characters on most phones.
    short_name: "AdimFit",
    description:
      "A coach that remembers every session. Adaptive training built from your own training history.",
    start_url: "/",
    // `standalone` is what removes the browser chrome — the difference
    // between a bookmark and something that feels like an app.
    display: "standalone",
    orientation: "portrait",
    background_color: "#090A0C",
    theme_color: "#090A0C",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        // Android crops icons to a circle or squircle. A maskable icon
        // keeps its content inside the central 80% so nothing is lost.
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Ask your coach",
        short_name: "Coach",
        url: "/coach",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Log a workout",
        short_name: "Log",
        url: "/log",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}