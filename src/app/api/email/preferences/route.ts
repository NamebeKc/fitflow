// src/app/api/email/preferences/route.ts
import { NextResponse } from "next/server";

import { getAdminAuth } from "@/lib/firebase-admin";
import {
  EMAIL_KINDS,
  readPreferences,
  setLifecycle,
  type EmailKind,
} from "@/lib/email/preferences";

/**
 * ── EMAIL PREFERENCES, FROM INSIDE THE APP ──────────────────────────
 * WHY THIS ROUTE EXISTS AT ALL. The preference lives at
 * `users/{uid}/settings/email`, and `firestore.rules` says:
 *
 *     match /settings/{settingId} { allow read, write: if false; }
 *
 * The browser cannot touch it, by design — the same documents carry
 * reminder scheduling that the push cron trusts. So the toggle needs a
 * server hop, exactly as `push/subscribe` does. This is the authorised
 * door, not a workaround for the rule.
 *
 * THE OTHER DOOR IS THE UNSUBSCRIBE LINK, and the two are deliberately
 * asymmetric. `email/unsubscribe` takes an HMAC and no session, and can
 * only turn lifecycle mail OFF. This route requires a verified ID token
 * and can turn it either way. Re-subscribing is the privileged
 * operation: we must know who is asking before we start mailing
 * someone again.
 *
 * FAILING LOUD, ON PURPOSE. The send path reads preferences through
 * `loadPreferences`, which suppresses mail if the read fails — the
 * cost of a missed weekly summary is nothing, the cost of mailing
 * someone who opted out is a complaint against a domain with no
 * reputation. A UI read has the opposite cost: showing "off" because
 * Firestore blinked invites the user to turn something on that was
 * never off, and writes a document to that effect. So this route uses
 * `readPreferences`, which throws, and returns a 500 the card can show
 * as an error rather than as a state.
 */

async function requireUid(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    return (await getAdminAuth().verifyIdToken(token)).uid;
  } catch {
    return null;
  }
}

/**
 * The labels for what the switch governs, derived from EMAIL_KINDS
 * rather than retyped here.
 *
 * Two lists, deduplicated: `trial_ending` and `trial_ended` share the
 * label "Trial reminders", and showing it twice would read as a bug.
 * Deriving them means a new kind in `preferences.ts` appears in the UI
 * without anyone remembering to add it — which is the only way a list
 * like this stays true.
 */
function labels(lifecycle: boolean): string[] {
  const out: string[] = [];
  for (const kind of Object.keys(EMAIL_KINDS) as EmailKind[]) {
    const entry = EMAIL_KINDS[kind];
    if (entry.lifecycle !== lifecycle) continue;
    if (!out.includes(entry.label)) out.push(entry.label);
  }
  return out;
}

export async function GET(request: Request) {
  const uid = await requireUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const preferences = await readPreferences(uid);
    return NextResponse.json({
      lifecycle: preferences.lifecycle,
      updatedAt: preferences.updatedAt || null,
      optional: labels(true),
      always: labels(false),
    });
  } catch (error) {
    console.error("[email/preferences] Read failed:", uid, error);
    return NextResponse.json(
      { error: "Couldn't load your email settings." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const uid = await requireUid(request);
  if (!uid) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { lifecycle?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Strictly a boolean. A missing or mistyped field must not be
  // coerced — `undefined` falsing its way through here would silently
  // unsubscribe someone who opened the page and changed nothing.
  if (typeof body.lifecycle !== "boolean") {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 },
    );
  }

  try {
    await setLifecycle(uid, body.lifecycle);
    return NextResponse.json({ lifecycle: body.lifecycle });
  } catch (error) {
    console.error("[email/preferences] Write failed:", uid, error);
    return NextResponse.json(
      { error: "Couldn't save that. Please try again." },
      { status: 500 },
    );
  }
}
