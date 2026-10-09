// src/app/(app)/coach/page.tsx
import { Suspense } from "react";

import { ChatInterface } from "@/components/coach/ChatInterface";
import { RestTimer } from "@/components/coach/RestTimer";
import { SessionTimer } from "@/components/coach/SessionTimer";

/**
 * AI Coach route.
 *
 * The chat card is pinned to the viewport so the message list scrolls
 * internally while the composer stays anchored. `dvh` rather than `vh`
 * matters on mobile: browsers shrink the visible area when their
 * address bar shows, and `vh` ignores that, pushing the composer
 * off-screen.
 *
 * Two fixed-height rows sit above the conversation: the session
 * stopwatch (counts up, whole workout) and the rest timer (counts down,
 * between sets). Neither changes height between its idle, running and
 * finished states — so the chat below never shifts, which matters when
 * someone is reading it mid-set.
 *
 * Order is deliberate. The session clock is started once at the top of
 * a workout and then ignored; the rest presets are tapped between every
 * set. The thing touched more often sits nearer the thumb.
 */
export default function CoachPage() {
  return (
    <div className="flex h-[calc(100dvh-12.5rem-env(safe-area-inset-bottom))] flex-col gap-3 md:h-[calc(100dvh-10rem)] md:gap-4">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          Adaptive coaching
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
          AI Coach
        </h1>
      </header>

      <SessionTimer />

      <RestTimer />

      <Suspense fallback={null}>
        <ChatInterface />
      </Suspense>
    </div>
  );
}