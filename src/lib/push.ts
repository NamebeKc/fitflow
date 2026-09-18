// src/lib/push.ts
"use client";

/**
 * ── PUSH SUBSCRIPTION ───────────────────────────────────────────────
 * Built because a tester said the thing that actually matters: "I
 * workout daily but I forget to log in." That isn't a discoverability
 * problem or a UI problem — logging depends on remembering, and
 * remembering is what fails. No amount of making the Log tab easier to
 * find helps someone who never thinks to open the app.
 *
 * Push works in a PWA: Chrome and Android fully, iOS Safari from 16.4
 * but ONLY once the app is installed to the home screen. That last
 * constraint is worth surfacing rather than hiding — an iPhone user
 * who enables reminders in a browser tab and receives nothing will
 * conclude the feature is broken.
 * ─────────────────────────────────────────────────────────────────────
 */

export type PushSupport =
  | "supported"
  | "needs-install" // iOS, not yet added to home screen
  | "unsupported";

/** What the browser can actually do, reported honestly. */
export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";

  const hasApi =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  if (!hasApi) {
    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !/crios|fxios/i.test(navigator.userAgent);
    // Safari exposes the Push API only in an installed PWA, so a
    // missing API on iOS means "install first", not "never".
    return isIOS ? "needs-install" : "unsupported";
  }

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !standalone) return "needs-install";

  return "supported";
}

/**
 * VAPID keys arrive base64url-encoded; the Push API wants raw bytes.
 *
 * The return type is annotated `Uint8Array<ArrayBuffer>` rather than
 * plain `Uint8Array`. Since TypeScript 5.7 the type is generic over
 * its backing buffer, and `applicationServerKey` accepts only a view
 * onto a real `ArrayBuffer` — never a `SharedArrayBuffer`. Allocating
 * the buffer explicitly proves that to the compiler instead of
 * casting the check away.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);

  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export interface SubscribeResult {
  ok: boolean;
  /** Present on failure — a message worth showing the user. */
  error?: string;
}

/**
 * Asks for permission and registers a subscription.
 *
 * Must be called from a user gesture. Browsers reject permission
 * requests that aren't tied to an explicit action, and a silent
 * rejection is indistinguishable from the user declining.
 */
export async function subscribeToPush(
  idToken: string,
  hour: number,
): Promise<SubscribeResult> {
  const support = pushSupport();
  if (support !== "supported") {
    return {
      ok: false,
      error:
        support === "needs-install"
          ? "Add AdimFit to your home screen first — iPhone only allows reminders for installed apps."
          : "This browser doesn't support reminders.",
    };
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.error("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
    return { ok: false, error: "Reminders aren't configured yet." };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        ok: false,
        error:
          permission === "denied"
            ? "Notifications are blocked for this site. You can re-enable them in your browser settings."
            : "Reminders need notification permission.",
      };
    }

    const registration = await navigator.serviceWorker.ready;

    // Reuse an existing subscription rather than creating a second
    // one — a device with two subscriptions receives every reminder
    // twice, which is the fastest route to someone turning them off.
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      }));

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        hour,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { ok: false, error: data.error ?? "Couldn't save your reminder." };
    }

    return { ok: true };
  } catch (error) {
    console.error("[push] Subscribe failed:", error);
    return { ok: false, error: "Couldn't set up reminders. Please try again." };
  }
}

/** Turns reminders off and removes the browser subscription. */
export async function unsubscribeFromPush(idToken: string): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();

    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } catch (error) {
    console.error("[push] Unsubscribe failed:", error);
  }
}