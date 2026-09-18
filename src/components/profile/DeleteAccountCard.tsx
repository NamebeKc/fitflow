// src/components/profile/DeleteAccountCard.tsx
"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { useAuth } from "@/components/providers/AuthProvider";
import { track } from "@/lib/analytics";

/**
 * ── DELETING AN ACCOUNT ─────────────────────────────────────────────
 * Deliberately requires typing DELETE rather than a single tap.
 *
 * This is one of the few places where friction is the correct design.
 * The action is irreversible and destroys months of training history;
 * a confirm dialog is dismissed reflexively, whereas typing a word
 * requires reading the sentence above it. The same reasoning that
 * makes one-tap logging right makes one-tap deletion wrong.
 *
 * It is still findable, though — a legally required right hidden
 * behind a support email isn't really provided.
 * ─────────────────────────────────────────────────────────────────────
 */
export function DeleteAccountCard() {
  const { user, signOutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText.trim().toUpperCase() === "DELETE";

  async function deleteAccount() {
    if (!user || !canDelete || busy) return;

    setBusy(true);
    setError(null);

    try {
      // Force a fresh token: the endpoint checks for revocation, and a
      // stale one would fail with a confusing message.
      const idToken = await user.getIdToken(true);

      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "We couldn't delete the account.");
        setBusy(false);
        return;
      }

      track("account_deleted");
      // The auth record is gone; signing out clears local state and
      // returns them to the landing page.
      await signOutUser();
    } catch (deleteError) {
      console.error("[profile] Account deletion failed:", deleteError);
      setError("Couldn't reach the server. Please try again.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-center text-[13px] text-white/50 underline underline-offset-4 outline-none transition-colors hover:text-red-300 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
      >
        Delete my account
      </button>
    );
  }

  return (
    <section className="rounded-3xl border border-red-500/25 bg-red-500/[0.04] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-red-300" strokeWidth={2} />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-300/80">
          Delete account
        </p>
      </div>

      <p className="mt-3 text-[15px] font-semibold text-white">
        This removes everything, permanently.
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-white/60">
        Your profile, every logged workout, your coach conversations and
        your progress history. It cannot be undone, and we cannot restore
        it afterwards.
      </p>

      <label className="mt-5 block">
        <span className="text-[13px] font-medium text-white/60">
          Type DELETE to confirm
        </span>
        <input
          type="text"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          autoComplete="off"
          className="mt-1.5 w-full rounded-xl border border-white/[0.09] bg-black/50 px-4 py-3 text-[15px] text-white outline-none transition-colors placeholder:text-white/40 focus:border-red-400/60"
          placeholder="DELETE"
        />
      </label>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-200"
        >
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-2.5">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmText("");
            setError(null);
          }}
          className="flex-1 rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white/70 outline-none transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          Keep my account
        </button>
        <button
          type="button"
          onClick={() => void deleteAccount()}
          disabled={!canDelete || busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-500/90 px-5 py-3 text-sm font-semibold text-white outline-none transition-all hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-red-400 active:scale-[0.99] disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
          ) : (
            "Delete forever"
          )}
        </button>
      </div>
    </section>
  );
}