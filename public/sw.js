// public/sw.js
/*
 * ── SERVICE WORKER ──────────────────────────────────────────────────
 * Rewritten after it spent a day serving stale JavaScript over a
 * correctly-deployed build.
 *
 * Two defects caused that, and both are structural rather than
 * incidental:
 *
 * 1. THE CACHE NAME NEVER CHANGED. `adimfit-v1` was hardcoded, so
 *    every deploy inherited the previous deploy's assets forever. The
 *    version below must be bumped on release — or better, treated as
 *    the thing that makes a deploy take effect for returning users.
 *
 * 2. IT CACHED HTML DOCUMENTS. A cached page references the JS chunk
 *    hashes that existed when it was stored. Serve that page after a
 *    deploy and the browser dutifully loads the OLD chunks, running
 *    old code against a new server. This is the failure that hid a
 *    working fix for hours.
 *
 * The rule now: NEVER cache documents. Only cache content-hashed
 * static assets, which are safe by construction — a new build produces
 * new filenames, so stale entries simply stop being requested.
 * ─────────────────────────────────────────────────────────────────────
 */

// Bump on every release. This is what invalidates returning users.
const VERSION = "v3-push-2026-09-08";
const CACHE = `adimfit-${VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/logo.png", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // Take over immediately rather than waiting for every tab to
      // close — otherwise a fix ships and nobody receives it until
      // they quit the app entirely.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Requests that must always hit the network, uncached. */
function isNeverCached(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firebaseapp.com") ||
    url.hostname.includes("google.com") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("posthog.com")
  );
}

/**
 * Only content-hashed build output is safe to cache.
 *
 * Next.js emits these with a hash in the filename, so a new build
 * produces new names and old entries are simply never requested again.
 * Anything else — documents especially — can go stale in ways the
 * browser cannot detect.
 */
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNeverCached(url)) return;

  // ── Navigations: network only ─────────────────────────────────────
  // Never served from cache. The offline page appears only when the
  // network genuinely cannot be reached — not merely because one
  // request was slow, which is what previously showed people an
  // offline screen while they were online.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return offline ?? Response.error();
      }),
    );
    return;
  }

  // ── Immutable assets: cache-first, safe because names are hashed ──
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
    return;
  }

  // ── Everything else: straight to the network, uncached ────────────
  // If it isn't a document and isn't content-hashed, we cannot tell
  // whether a cached copy is still correct — so we don't keep one.
});

/* ══ PUSH NOTIFICATIONS ═══════════════════════════════════════════ */

/**
 * A push event MUST result in a visible notification.
 *
 * Browsers permit "silent" pushes only briefly before revoking the
 * permission entirely — showing something every time is not just
 * courtesy, it's what keeps the subscription alive. Hence the fallback
 * copy if the payload is missing or malformed.
 */
self.addEventListener("push", (event) => {
  let payload = {
    title: "AdimFit",
    body: "Time to move.",
    url: "/coach",
  };

  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Malformed payload — the defaults above still satisfy the
    // must-show-something rule.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Same tag each day so a second push replaces rather than
      // stacks — nobody wants five reminders in their shade.
      tag: "adimfit-reminder",
      renotify: false,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an open tab rather than opening a second one — the
        // person usually already has the app somewhere.
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});