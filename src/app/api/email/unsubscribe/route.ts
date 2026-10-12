// src/app/api/email/unsubscribe/route.ts
import { NextResponse } from "next/server";

import { setLifecycle, verifyUnsubscribeToken } from "@/lib/email/preferences";
import { trackServer } from "@/lib/analytics-server";

/**
 * ── ONE-CLICK UNSUBSCRIBE ───────────────────────────────────────────
 * No sign-in, by design and by obligation.
 *
 * GET is the human: they tapped the footer link in a mail client,
 * possibly on a device they've never signed in on. They get a page.
 *
 * POST is Gmail and Yahoo. RFC 8058 one-click means the mail provider
 * POSTs this URL itself, with nobody present, and both now weight the
 * presence of a working `List-Unsubscribe-Post` header in filtering
 * decisions. A bulk sender without it gets filtered however good its
 * SPF is — so this endpoint is a deliverability feature as much as a
 * courtesy.
 *
 * Neither verb requires auth. The HMAC in the link is what stands in
 * for it, which is why `verifyUnsubscribeToken` is a constant-time
 * comparison and the secret never leaves the server.
 *
 * ONE DIRECTION ONLY. This endpoint can turn lifecycle email off. It
 * cannot turn it on — re-subscribing happens in the app, behind a
 * login, where we know who is asking. A link that could re-enable
 * mail would be a vector for doing it to someone else.
 */

async function unsubscribe(uid: string, token: string): Promise<boolean> {
  if (!uid || !token) return false;
  if (!verifyUnsubscribeToken(uid, token)) return false;
  await setLifecycle(uid, false);
  await trackServer(uid, "email_unsubscribed", {}).catch(() => {
    // Analytics must never decide whether an unsubscribe succeeded.
  });
  return true;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const ok = await unsubscribe(
    url.searchParams.get("u") ?? "",
    url.searchParams.get("t") ?? "",
  );
  // Gmail wants a 2xx and reads nothing else.
  return new NextResponse(null, { status: ok ? 200 : 400 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  let ok = false;
  try {
    ok = await unsubscribe(
      url.searchParams.get("u") ?? "",
      url.searchParams.get("t") ?? "",
    );
  } catch (error) {
    console.error("[email/unsubscribe] Failed:", error);
  }

  const title = ok ? "Unsubscribed" : "That link didn't work";
  const message = ok
    ? "You won't get weekly summaries, trial reminders or nudges from AdimFit again. Receipts and anything about a payment will still reach you — those aren't optional for a paid account."
    : "The link may have been altered in transit, or truncated by a mail client. Reply to any AdimFit email and I'll turn these off by hand.";

  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${title} · AdimFit</title></head>
     <body style="margin:0;background:#FAF7F3;color:#1F1914;
       font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
       <div style="max-width:520px;margin:0 auto;padding:64px 24px">
         <h1 style="font-size:24px;margin:0 0 16px;letter-spacing:-.02em">${title}</h1>
         <p style="line-height:1.6;margin:0 0 24px;color:#5F5A54">${message}</p>
         <a href="/" style="display:inline-block;background:#CCFF00;color:#1F1914;
            text-decoration:none;font-weight:600;padding:12px 20px;border-radius:4px">
            Back to AdimFit</a>
       </div></body></html>`,
    {
      status: ok ? 200 : 400,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
