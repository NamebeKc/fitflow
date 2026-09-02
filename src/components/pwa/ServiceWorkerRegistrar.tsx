// src/components/pwa/ServiceWorkerRegistrar.tsx
"use client";

import { useEffect } from "react";

/**
 * Registers the service worker.
 *
 * Renders nothing — it exists purely for its side effect, and lives in
 * a component so it runs on the client after hydration rather than
 * during render.
 *
 * DEVELOPMENT IS DELIBERATELY EXCLUDED. A service worker caching your
 * dev build is a genuinely miserable debugging experience: edits stop
 * appearing, hard refreshes lie to you, and the cause is invisible.
 * It registers in production only.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Wait for load so registration never competes with first paint.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("[pwa] Service worker registration failed:", error);
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}