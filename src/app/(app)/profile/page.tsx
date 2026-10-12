// src/app/(app)/profile/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Paywall } from "@/components/billing/Paywall";
import { SubscriptionCard } from "@/components/billing/SubscriptionCard";
import { InstallCard } from "@/components/pwa/InstallCard";
import { DeleteAccountCard } from "@/components/profile/DeleteAccountCard";
import { ReminderCard } from "@/components/profile/ReminderCard";
import { OnboardingWizard } from "@/components/profile/OnboardingWizard";
import { ProfileView } from "@/components/profile/ProfileView";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import type { UserProfile } from "@/lib/profile";

/**
 * Profile route.
 *
 * Carries three things: the training profile, subscription status, and
 * — when someone chooses to subscribe — the paywall itself, shown
 * inline rather than as a separate route. Billing lives beside the
 * account it belongs to.
 */
export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, isLoading, updateProfile } = useProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const busy = isLoading || isSaving;
  const showWizard = !busy && (!profile || isEditing);
  const showView = !busy && profile && !isEditing;

  async function handleComplete(next: UserProfile) {
    const isFirstSetup = !profile;
    setIsSaving(true);
    try {
      await updateProfile(next);
      setIsEditing(false);
      if (isFirstSetup) router.push("/coach?welcome=1");
    } finally {
      setIsSaving(false);
    }
  }

  // The paywall takes over the page — a subscribe decision deserves
  // the whole screen rather than competing with profile fields.
  if (showPaywall) {
    return (
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={() => setShowPaywall(false)}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-rule px-4 py-2 text-[13px] font-medium text-ink-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-moss"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2.5} />
          Back to profile
        </button>

        <Paywall
          headline="Choose your plan"
          subline="Keep your coach, your history, and everything you've built."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          {showView ? "Training profile" : "Setup"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink sm:text-3xl">
          Profile
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {showView
            ? "The context your coach plans around."
            : "A few details so your coaching is tailored to you."}
        </p>
      </header>

      {busy && <ProfileSkeleton />}

      {showWizard && (
        <OnboardingWizard
          initialProfile={profile}
          displayName={user?.displayName}
          onComplete={(next) => void handleComplete(next)}
        />
      )}

      {showView && (
        <div className="mx-auto w-full max-w-xl space-y-6">
          <SubscriptionCard onSubscribe={() => setShowPaywall(true)} />
          <InstallCard />
          <ReminderCard />
          <ProfileView profile={profile} onEdit={() => setIsEditing(true)} />

          {/* Last on the page, and behind a link — findable without
              being adjacent to anything routine. */}
          <DeleteAccountCard />
        </div>
      )}
    </div>
  );
}

/** Mirrors ProfileView's geometry so the load → view swap causes no shift. */
function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <Skeleton className="h-32 rounded-lg bg-paper-sunken" />
      <div className="rounded-lg border border-rule bg-paper-raised p-6">
        <div className="flex flex-row items-center gap-4">
          <Skeleton className="size-14 rounded-full bg-paper-sunken" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-36 rounded-sm bg-paper-sunken" />
            <Skeleton className="h-3 w-44 rounded bg-paper-sunken" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-md bg-paper-sunken" />
          ))}
        </div>
      </div>
    </div>
  );
}