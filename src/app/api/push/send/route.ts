// src/app/api/push/send/route.ts
import { NextResponse } from "next/server";
import webpush from "web-push";

import { getAdminDb } from "@/lib/firebase-admin";
import { trackServer } from "@/lib/analytics-server";

/**
 * ── SENDING REMINDERS ───────────────────────────────────────────────
 * Triggered hourly by Cloud Scheduler, not by a user. Protected by a
 * shared secret: this endpoint can message every user you have, so an
 * open one would be a spam cannon.
 *
 * THE RULE THAT MATTERS: never remind someone who has already trained
 * today. A notification telling a person to do the thing they just did
 * is worse than no notification — it proves the app isn't paying
 * attention, and it's the fastest route to permission being revoked.
 * That check is why this reads the workout log before sending.
 *
 * Runs hourly and selects users whose LOCAL time matches their chosen
 * hour, so one job covers every timezone without scheduling per-region.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Messages rotate so a daily reminder doesn't become wallpaper. */
const NUDGES = [
  {
    title: "Still time today",
    body: "Even twenty minutes counts. What are you up for?",
  },
  {
    title: "Your coach is ready",
    body: "Ask what to do today — it already knows what you've been doing.",
  },
  {
    title: "Log today's session",
    body: "Trained already? Record it while it's fresh.",
  },
  {
    title: "Quick one?",
    body: "A short session logged beats a perfect one skipped.",
  },
  {
    title: "Checking in",
    body: "No pressure — rest days count too. But if you're moving, log it.",
  },
];

/** yyyy-mm-dd in a given zone. */
function dateInZone(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Local hour (0-23) in a given zone. */
function hourInZone(timeZone: string, now: Date): number {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(now);
  return Number.parseInt(formatted, 10);
}

export async function POST(request: Request) {
  const secret = process.env.PUSH_CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");

  if (!secret || provided !== secret) {
    console.warn("[push/send] Rejected unauthenticated trigger");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_SUBJECT ?? "mailto:info@lushtechdia.com";

  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  webpush.setVapidDetails(contact, publicKey, privateKey);

  const now = new Date();
  const db = getAdminDb();

  let sent = 0;
  let skippedTrained = 0;
  let removed = 0;

  try {
    const settings = await db
      .collectionGroup("settings")
      .where("enabled", "==", true)
      .get();

    for (const doc of settings.docs) {
      if (doc.id !== "reminders") continue;

      const userRef = doc.ref.parent.parent;
      if (!userRef) continue;

      const data = doc.data() as { hour?: number; timeZone?: string };
      const timeZone = data.timeZone ?? "UTC";
      const wanted = typeof data.hour === "number" ? data.hour : 18;

      // Only this hour's users. The job runs hourly; each user matches
      // once per day in their own zone.
      if (hourInZone(timeZone, now) !== wanted) continue;

      const today = dateInZone(timeZone, now);

      // Already trained? Say nothing.
      const logged = await userRef
        .collection("workouts")
        .where("date", "==", today)
        .limit(1)
        .get();

      if (!logged.empty) {
        skippedTrained += 1;
        continue;
      }

      const devices = await userRef.collection("push").get();
      if (devices.empty) continue;

      // Rotate by date so the same person doesn't read the same line
      // every evening, but everyone gets a consistent one per day.
      const nudge = NUDGES[new Date(today).getDate() % NUDGES.length];

      const payload = JSON.stringify({
        title: nudge.title,
        body: nudge.body,
        url: "/coach",
      });

      for (const device of devices.docs) {
        const record = device.data() as {
          endpoint: string;
          p256dh: string;
          auth: string;
        };

        try {
          await webpush.sendNotification(
            {
              endpoint: record.endpoint,
              keys: { p256dh: record.p256dh, auth: record.auth },
            },
            payload,
          );
          sent += 1;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 404/410 mean the browser discarded the subscription —
          // uninstalled, permission revoked, or cleared storage.
          // Keeping it would mean retrying a dead endpoint forever.
          if (status === 404 || status === 410) {
            await device.ref.delete();
            removed += 1;
          } else {
            console.error("[push/send] Send failed:", status, error);
          }
        }
      }

      await trackServer(userRef.id, "reminder_sent", {}).catch(
        () => {},
      );
    }

    console.log(
      `[push/send] sent=${sent} skipped_trained=${skippedTrained} removed=${removed}`,
    );

    return NextResponse.json({ sent, skippedTrained, removed });
  } catch (error) {
    console.error("[push/send] Run failed:", error);
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}