// next.config.ts
import type { NextConfig } from "next";

/**
 * ── FIREBASE AUTH ON OUR OWN DOMAIN ──────────────────────────────────
 * Firebase's OAuth flow loads a handler page from whatever `authDomain`
 * is set to in `src/lib/firebase.ts`. By default that is
 * `<project-id>.firebaseapp.com`, which put an auto-generated Google
 * project ID in front of users mid-signup and read as untrustworthy.
 *
 * Rather than provision a separate hosting site for `auth.adimfit.com`,
 * these rewrites proxy the handler through the domain we already serve
 * from Cloud Run. `authDomain` is then set to `adimfit.com`, and no
 * Firebase-owned hostname is ever visible.
 *
 * BOTH PREFIXES ARE REQUIRED. `/__/auth/*` is the handler itself and
 * its scripts; `/__/firebase/*` serves `init.json`, which the handler
 * fetches to discover the project it belongs to. Proxying only the
 * first produces a handler that loads and then fails silently.
 *
 * `beforeFiles` runs the rewrite ahead of filesystem and dynamic-route
 * resolution, so nothing in the app can shadow these paths later.
 *
 * If the Firebase project ID ever changes, this constant changes with
 * it — it is the one place the old hostname still legitimately appears.
 * ─────────────────────────────────────────────────────────────────────
 */
const FIREBASE_AUTH_HOST = "gen-lang-client-0453085520.firebaseapp.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/__/auth/:path*",
          destination: `https://${FIREBASE_AUTH_HOST}/__/auth/:path*`,
        },
        {
          source: "/__/firebase/:path*",
          destination: `https://${FIREBASE_AUTH_HOST}/__/firebase/:path*`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;