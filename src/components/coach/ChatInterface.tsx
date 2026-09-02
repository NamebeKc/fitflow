// src/components/coach/ChatInterface.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, SendHorizonal, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageBubble } from "@/components/coach/MessageBubble";
import { CoachTyping } from "@/components/coach/CoachTyping";
import { PlanCard } from "@/components/coach/PlanCard";
import { useAuth } from "@/components/providers/AuthProvider";
import { findExerciseVideos, type ExerciseVideo } from "@/lib/exercise-videos";
import {
  clearMessages,
  deleteMessage,
  loadMessages,
  nowISO,
  saveMessage,
} from "@/lib/chat";
import { track } from "@/lib/analytics";
import {
  extractPlan,
  loadPlansForDates,
  markPlanCompleted,
  planToNotes,
  savePlan,
  type DayPlan,
} from "@/lib/plans";
import { addWorkout, todayISO, type WorkoutEntry } from "@/lib/workouts";
import { Paywall } from "@/components/billing/Paywall";

export interface ChatMessage {
  id: string;
  role: "user" | "coach";
  content: string;
  videos?: ExerciseVideo[];
  hidden?: boolean;
  /** Structured session attached to this reply, if any. */
  plan?: DayPlan | null;
}

const SUGGESTIONS = [
  "Plan today's session",
  "Suggest a beginner routine",
  "How do I fix my squat form?",
  "Build me a weekly split",
];

const WELCOME_PROMPT =
  "I've just finished setting up my profile. Greet me by name in two or " +
  "three short sentences: welcome me to AdimFit, mention my goal and one " +
  "of my preferred activities, and invite me to ask you anything or log " +
  "my first workout. Do not prescribe a full plan yet.";

/**
 * The conversational coaching surface.
 *
 * Replies stream, persist to Firestore, and — when the coach
 * prescribes a session — carry a structured plan that renders as a
 * tappable card. Logging that session is one tap; nothing is retyped.
 *
 * The browser's time zone travels with every request so the coach can
 * reason about "today" in the user's local terms rather than the
 * server's.
 */
export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  // Clearing is irreversible, so it asks first — one accidental tap
  // shouldn't destroy a conversation.
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
  // Set when the server returns 402 — the paywall replaces the chat
  // rather than appearing over it, since there's nothing to go back to.
  const [paywalled, setPaywalled] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSentRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const inFlightRef = useRef(false);

  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isBusy = isThinking || streamingId !== null;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ── Load the stored transcript ────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    loadMessages(user.uid)
      .then(async (stored) => {
        if (cancelled) return;

        const restored: ChatMessage[] = stored.map((message) => {
          if (message.role !== "coach") {
            return {
              id: message.id,
              role: message.role,
              content: message.content,
              hidden: message.hidden,
            };
          }
          const { text, plan } = extractPlan(message.content);
          return {
            id: message.id,
            role: "coach",
            content: text,
            hidden: message.hidden,
            videos: findExerciseVideos(text),
            plan,
          };
        });

        // Plans rebuilt from message text always look untouched —
        // the completion flag lives in Firestore, not in the reply.
        // Merge it back, or every logged session reappears as new.
        const dates = restored
          .map((message) => message.plan?.date)
          .filter((date): date is string => Boolean(date));

        if (dates.length > 0) {
          const savedPlans = await loadPlansForDates(user.uid, dates);
          if (cancelled) return;

          for (const message of restored) {
            const saved = message.plan && savedPlans.get(message.plan.date);
            if (saved?.completedWorkoutId && message.plan) {
              message.plan = {
                ...message.plan,
                completedWorkoutId: saved.completedWorkoutId,
              };
            }
          }
        }

        messagesRef.current = restored;
        setMessages(restored);
      })
      .catch((error) => {
        console.error("[chat] Failed to load history:", error);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: streamingId ? "auto" : "smooth",
    });
  }, [messages, isThinking, streamingId, isLoadingHistory]);

  /** Sends history, reads the reply stream, then persists the result. */
  const requestCoachReply = useCallback(
    async (history: ChatMessage[]) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      setIsThinking(true);
      const replyId = crypto.randomUUID();
      let bubbleCreated = false;

      try {
        if (!user) {
          throw new Error("You need to be signed in to chat with your coach.");
        }
        const idToken = await user.getIdToken();

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            messages: history.map(({ role, content }) => ({ role, content })),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });

        if (response.status === 402) {
          const data: { error?: string } = await response
            .json()
            .catch(() => ({}));
          track("paywall_shown", { trigger: "coach_message" });
          setPaywalled(true);
          // Drop the message that couldn't be answered so the
          // transcript doesn't show an unanswered question.
          setMessages((prev) =>
            prev.filter((message) => message.id !== history[history.length - 1]?.id),
          );
          throw new Error(data.error ?? "Subscription required");
        }

        if (!response.ok || !response.body) {
          const data: { error?: string } = await response
            .json()
            .catch(() => ({}));
          throw new Error(data.error ?? "Request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;

          accumulated += chunk;
          if (!accumulated.trim()) continue;

          // Hide the plan block while it streams in — the user should
          // never watch raw JSON appear in the transcript.
          const visible = stripPartialPlan(accumulated);

          if (!bubbleCreated) {
            bubbleCreated = true;
            setIsThinking(false);
            setStreamingId(replyId);
            setMessages((prev) => [
              ...prev,
              { id: replyId, role: "coach", content: visible },
            ]);
            continue;
          }

          setMessages((prev) =>
            prev.map((message) =>
              message.id === replyId
                ? { ...message, content: visible }
                : message,
            ),
          );
        }

        const raw = accumulated.trim();
        if (!raw) throw new Error("Empty reply");

        const { text, plan } = extractPlan(raw);

        setMessages((prev) =>
          prev.map((message) =>
            message.id === replyId
              ? {
                  ...message,
                  content: text,
                  videos: findExerciseVideos(text),
                  plan,
                }
              : message,
          ),
        );

        // Persist the full reply (plan block included) so reloading
        // reconstructs the card exactly.
        await saveMessage(user.uid, {
          id: replyId,
          role: "coach",
          content: raw,
          createdAt: nowISO(),
        });

        if (plan) {
          track("plan_prescribed", {
            activity: plan.activity,
            intensity: plan.intensity,
            exercise_count: plan.exercises.length,
            estimated_minutes: plan.estimatedMinutes,
          });
          await savePlan(user.uid, plan).catch((error) => {
            console.error("[chat] Failed to save plan:", error);
          });
        }
      } catch (error) {
        // A paywall is not an error to report in the transcript.
        if (paywalled) return;

        // Replace the failed exchange with the error, and DROP the
        // user's message from the transcript.
        //
        // Leaving it created an orphan — a user turn with no reply —
        // and the next request then sent two user turns in a row, which
        // the API rejects. Every retry added another, so a conversation
        // that failed once could never recover. The message isn't lost
        // to the person: it's still in the composer's history and the
        // error invites them to ask again.
        const failedUserId = history[history.length - 1]?.id;

        setMessages((prev) => [
          ...prev.filter(
            (message) => message.id !== replyId && message.id !== failedUserId,
          ),
          {
            id: crypto.randomUUID(),
            role: "coach",
            content: coachErrorMessage(error, bubbleCreated),
          },
        ]);

        // Remove it from storage too, or a reload restores the orphan.
        if (user && failedUserId) {
          void deleteMessage(user.uid, failedUserId).catch(() => {
            // Best effort — the server also repairs malformed history.
          });
        }
      } finally {
        inFlightRef.current = false;
        setIsThinking(false);
        setStreamingId(null);
      }
    },
    [user, paywalled],
  );

  const send = useCallback(
    (text: string, options?: { hidden?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed || !user || inFlightRef.current) return;

      const outgoing: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        hidden: options?.hidden,
      };

      const next = [...messagesRef.current, outgoing];

      // Distinguishing the FIRST message is what makes activation
      // measurable — it's the moment the product's core promise lands.
      if (messagesRef.current.length === 0) {
        track("coach_first_message_sent");
      }
      track("coach_message_sent", {
        hidden: Boolean(options?.hidden),
        turn: next.filter((message) => message.role === "user").length,
        // Message CONTENT is never sent.
      });

      messagesRef.current = next;
      setMessages(next);

      void saveMessage(user.uid, {
        id: outgoing.id,
        role: "user",
        content: trimmed,
        hidden: options?.hidden,
        createdAt: nowISO(),
      }).catch((error) => {
        console.error("[chat] Failed to save message:", error);
      });

      void requestCoachReply(next);

      setDraft("");
      inputRef.current?.focus();
    },
    [requestCoachReply, user],
  );

  // Deep links: consumed once, then stripped from the URL.
  useEffect(() => {
    if (autoSentRef.current || !user || isLoadingHistory) return;

    const welcome = searchParams.get("welcome") === "1";
    const prompt = searchParams.get("prompt");
    if (!welcome && !prompt) return;

    autoSentRef.current = true;

    if (welcome) {
      if (messagesRef.current.length === 0) {
        send(WELCOME_PROMPT, { hidden: true });
      }
    } else if (prompt) {
      send(prompt);
    }

    router.replace("/coach", { scroll: false });
  }, [searchParams, user, isLoadingHistory, send, router]);

  /** One tap: turn a prescribed plan into a logged workout. */
  const logPlan = useCallback(
    async (plan: DayPlan) => {
      if (!user) return;

      const entry: WorkoutEntry = {
        id: crypto.randomUUID(),
        activity: plan.activity,
        title: plan.title,
        date: plan.date || todayISO(),
        durationMin: plan.estimatedMinutes,
        intensity: plan.intensity,
        notes: planToNotes(plan),
        createdAt: nowISO(),
      };

      track("plan_logged_one_tap", {
        activity: plan.activity,
        intensity: plan.intensity,
        duration_min: plan.estimatedMinutes,
        exercise_count: plan.exercises.length,
      });
      track("workout_log_completed", {
        activity: plan.activity,
        intensity: plan.intensity,
        duration_min: plan.estimatedMinutes,
        source: "coach_card",
      });

      const updated = await addWorkout(user.uid, entry);

      // Logging straight from a plan card can equally be someone's
      // first ever session, so the milestone is checked here too.
      if (updated.length === 1) {
        track("workout_first_logged", { source: "coach_card" });
      }

      await markPlanCompleted(user.uid, plan.date, entry.id).catch((error) => {
        console.error("[chat] Failed to mark plan complete:", error);
      });

      setLoggedDates((prev) => new Set(prev).add(plan.date));
    },
    [user],
  );

  async function handleClear() {
    if (!user || isBusy) return;
    setIsClearing(true);
    try {
      track("conversation_cleared");
      await clearMessages(user.uid);
      messagesRef.current = [];
      setMessages([]);
      autoSentRef.current = true;
      setConfirmingClear(false);
    } catch (error) {
      console.error("[chat] Failed to clear conversation:", error);
    } finally {
      setIsClearing(false);
    }
  }

  if (paywalled) {
    return (
      <section className="flex min-h-0 flex-1 items-center overflow-y-auto py-6">
        <Paywall />
      </section>
    );
  }

  const visibleMessages = messages.filter((message) => !message.hidden);
  const isEmpty = visibleMessages.length === 0 && !isBusy && !isLoadingHistory;

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/[0.07] bg-[#14161A]"
      aria-label="Chat with your AI coach"
    >
      {/*
        Always present, not only once messages exist. Starting fresh is
        a normal thing to want, and a control that appears and vanishes
        is one people never learn is there.
      */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5 md:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
          {visibleMessages.length > 0
            ? `${visibleMessages.length} message${
                visibleMessages.length === 1 ? "" : "s"
              }`
            : "New conversation"}
        </p>

        {confirmingClear ? (
          <div className="flex items-center gap-1.5">
            <span className="hidden text-[12px] text-white/60 sm:inline">
              Start over?
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmingClear(false)}
              className="h-8 px-3 text-[12px] text-white/60 hover:bg-white/[0.06] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleClear()}
              disabled={isClearing}
              className="h-8 gap-1.5 rounded-full bg-[#CCFF00] px-3.5 text-[12px] font-semibold text-black hover:bg-[#d9ff33] active:scale-[0.98]"
            >
              {isClearing ? "Clearing…" : "Yes, reset"}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmingClear(true)}
            disabled={isBusy || visibleMessages.length === 0}
            className="h-8 gap-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" strokeWidth={2} />
            Reset
          </Button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scroll-smooth px-5 py-6 md:px-8"
      >
        {isLoadingHistory ? (
          <TranscriptSkeleton />
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.07]">
              <Sparkles className="size-6 text-[#CCFF00]" strokeWidth={2} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">
                Your coach is ready
              </h2>
              <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/60">
                Ask about training plans, technique, or recovery — or start
                with one of these.
              </p>
            </div>

            <div className="flex max-w-md flex-wrap justify-center gap-2.5">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="rounded-full border-white/[0.07] bg-black/30 px-4 font-normal text-white/60 shadow-none transition-all hover:border-[#CCFF00]/25 hover:bg-black/40 hover:text-white active:scale-[0.99]"
                  onClick={() => send(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>

            {/*
              A pilot user did 300 skips, asked the coach to log them,
              was correctly refused, and concluded manual logging wasn't
              possible — with the Log tab one tap away. This line exists
              so nobody reaches that conclusion again.
            */}
            <p className="max-w-sm text-[13px] leading-relaxed text-white/50">
              Already trained today?{" "}
              <Link
                href="/log"
                className="text-[#CCFF00]/80 underline underline-offset-4 transition-colors hover:text-[#CCFF00]"
              >
                Record it on the Log tab
              </Link>{" "}
              — the coach picks it up from there.
            </p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {visibleMessages.map((message) => (
              <div key={message.id} className="space-y-3">
                <MessageBubble
                  role={message.role}
                  content={message.content}
                  videos={message.videos}
                  isStreaming={message.id === streamingId}
                />

                {message.plan && (
                  <PlanCard
                    plan={message.plan}
                    completed={
                      Boolean(message.plan.completedWorkoutId) ||
                      loggedDates.has(message.plan.date)
                    }
                    onLog={logPlan}
                  />
                )}
              </div>
            ))}
            {isThinking && <CoachTyping />}
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.06] px-4 py-3.5 md:px-6">
        <form
          className="mx-auto flex max-w-2xl items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isBusy) send(draft);
          }}
        >
          <Input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message your coach…"
            aria-label="Message your coach"
            disabled={isLoadingHistory}
            className="h-11 flex-1 rounded-full border-white/[0.07] bg-black/50 px-5 text-[15px] text-white shadow-none placeholder:text-white/50 focus-visible:border-[#CCFF00]/60 focus-visible:bg-black/70 focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!draft.trim() || isBusy || isLoadingHistory}
            aria-label="Send message"
            className="size-11 shrink-0 rounded-full bg-[#CCFF00] text-black shadow-[0_10px_30px_-10px_rgba(204,255,0,0.5)] transition-all hover:bg-[#d9ff33] active:scale-[0.97] disabled:opacity-30 disabled:shadow-none"
          >
            <SendHorizonal className="size-5" strokeWidth={2} />
          </Button>
        </form>
      </div>
    </section>
  );
}

/**
 * What the coach says when something breaks.
 *
 * The old message was one line for every failure: "couldn't reach the
 * coaching service (Failed to fetch)". That's the developer's view of
 * the problem, not the user's — it names a browser API, offers no
 * useful action, and reads identically whether their wifi dropped or
 * our server fell over.
 *
 * These distinguish the cases the user can actually do something
 * about, and stay in the coach's voice rather than switching to a
 * system tone mid-conversation. Nobody wants an error dialog from
 * something that was talking to them like a person a second ago.
 */
function coachErrorMessage(error: unknown, hadStarted: boolean): string {
  const message = error instanceof Error ? error.message : "";

  // The browser is offline. Unambiguous, and entirely theirs to fix.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Looks like you're offline. I'll be here when your connection is back — nothing you've logged is lost.";
  }

  // The reply began and then stopped. Worth saying so explicitly:
  // otherwise a half-written answer vanishing looks like a bug they
  // caused.
  if (hadStarted) {
    return "I lost my train of thought halfway through that one — the connection dropped. Ask me again and I'll pick it up properly.";
  }

  // fetch() rejected outright: DNS, reset connection, blocked request.
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "I couldn't get through just now — that's usually a patchy connection on one end or the other. Give it another go in a moment.";
  }

  // Our end, explicitly. Saying so is better than implying it was them.
  if (/^5\d\d/.test(message) || /couldn't reach your training data/i.test(message)) {
    return "That one's on me — I couldn't reach your training history, and I'd rather not guess at a plan without it. Try again shortly.";
  }

  if (/expired|sign in/i.test(message)) {
    return "Your session timed out. Sign in again and we'll carry on from where we left off.";
  }

  return "Something went wrong on my side there. Try again in a moment — and if it keeps happening, info@lushtechdia.com reaches a human.";
}

/**
 * Removes a plan block — complete or still arriving — from streaming
 * text. Without this the user watches raw JSON type itself out before
 * it disappears.
 */
function stripPartialPlan(text: string): string {
  const open = text.indexOf("<plan>");
  if (open === -1) return text;
  return text.slice(0, open).trim();
}

/** Placeholder bubbles while the stored transcript loads. */
function TranscriptSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex justify-end">
        <Skeleton className="h-11 w-2/5 rounded-2xl rounded-br-md bg-white/[0.06]" />
      </div>
      <div className="flex justify-start">
        <Skeleton className="h-24 w-3/4 rounded-2xl rounded-bl-md bg-white/[0.06]" />
      </div>
      <div className="flex justify-end">
        <Skeleton className="h-11 w-1/3 rounded-2xl rounded-br-md bg-white/[0.06]" />
      </div>
    </div>
  );
}