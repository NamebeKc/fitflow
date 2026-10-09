// src/components/profile/ProfileView.tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { LogOut, Pencil, Target } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  activityLabel,
  coachingStyleLabel,
  environmentLabel,
  equipmentLabel,
  goalLabel,
  profileGoals,
  type UserProfile,
} from "@/lib/profile";

interface ProfileViewProps {
  profile: UserProfile;
  onEdit: () => void;
}

/**
 * Read-only summary of the saved profile.
 *
 * This screen also carries sign-out. The sidebar's sign-out button
 * only exists at lg+, and the mobile tab bar has no room for one — so
 * without this, phone users would have no way to sign out at all.
 */
export function ProfileView({ profile, onEdit }: ProfileViewProps) {
  const prefersReducedMotion = useReducedMotion();
  const { user, signOutUser } = useAuth();

  const memberSince = new Date(profile.createdAt).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mx-auto w-full max-w-xl space-y-5"
    >
      <Card className="border-rule bg-paper-raised text-ink shadow-none">
        {/* ── Identity header ───────────────────────────────────────── */}
        <CardHeader className="flex flex-row items-center gap-3 pb-5 sm:gap-4">
          <Avatar className="size-12 shrink-0 border border-rule sm:size-14">
            {user?.photoURL && <AvatarImage src={user.photoURL} alt="" />}
            <AvatarFallback className="bg-paper-raised text-lg font-semibold text-indigo">
              {profile.firstName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-[-0.02em] text-ink sm:text-xl">
              {profile.firstName}
            </h2>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              Member since {memberSince}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="h-9 shrink-0 gap-2 rounded-full border-rule bg-transparent px-3 text-ink-muted shadow-none hover:border-indigo/30 hover:bg-paper-sunken hover:text-ink sm:px-4"
          >
            <Pencil className="size-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ── Key stats ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-md border border-rule bg-ink/30 p-3.5 sm:p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
                Age
              </p>
              <p className="mt-2 font-mono text-2xl tabular-nums text-ink">
                {profile.age}
              </p>
            </div>

            <div className="rounded-md border border-rule bg-ink/30 p-3.5 sm:p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
                Weight
              </p>
              <p className="mt-2 font-mono text-2xl tabular-nums text-ink">
                {profile.weightKg}
                <span className="ml-1 text-sm text-ink-muted">kg</span>
              </p>
            </div>

            <div className="col-span-2 rounded-md border border-indigo/20 bg-indigo/[0.05] p-3.5 sm:col-span-1 sm:p-4">
              <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-indigo/70">
                <Target className="size-3" strokeWidth={2.5} />
                {profileGoals(profile).length > 1 ? "Goals" : "Goal"}
              </p>
              <p className="mt-2 text-sm font-semibold leading-snug text-ink">
                {profileGoals(profile).map(goalLabel).join(" + ") || "Not set"}
              </p>
            </div>
          </div>

          <Separator className="bg-paper-sunken" />

          {/* ── Preferred activities ────────────────────────────────── */}
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
              Preferred activities
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.activities.map((activity) => (
                <span
                  key={activity}
                  className="rounded-full border border-rule bg-ink/30 px-3.5 py-1.5 text-sm font-medium text-ink-muted"
                >
                  {activityLabel(activity)}
                </span>
              ))}
            </div>
          </div>

          {/* ── Where they train ────────────────────────────────────── */}
          {profile.environment && profile.environment.length > 0 && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                Training environment
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.environment.map((environment) => (
                  <span
                    key={environment}
                    className="rounded-full border border-rule bg-ink/30 px-3.5 py-1.5 text-sm font-medium text-ink-muted"
                  >
                    {environmentLabel(environment)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── What they train with ────────────────────────────────── */}
          {profile.equipment && profile.equipment.length > 0 && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                Equipment
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.equipment.map((equipment) => (
                  <span
                    key={equipment}
                    className="rounded-full border border-rule bg-ink/30 px-3.5 py-1.5 text-sm font-medium text-ink-muted"
                  >
                    {equipmentLabel(equipment)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.coachingStyle && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                Coaching style
              </p>
              <span className="inline-block rounded-full border border-rule bg-ink/30 px-3.5 py-1.5 text-sm font-medium text-ink-muted">
                {coachingStyleLabel(profile.coachingStyle)}
              </span>
            </div>
          )}

          <p className="text-xs leading-relaxed text-ink-muted">
            Your coach references this profile when planning sessions. It syncs
            privately to your account and is available on every device you sign
            in from.
          </p>
        </CardContent>
      </Card>

      {/* ── Account ───────────────────────────────────────────────── */}
      <Card className="border-rule bg-paper-raised text-ink shadow-none">
        <CardContent className="flex items-center gap-3 p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">Signed in</p>
            <p className="truncate text-sm text-ink-muted">
              {user?.email ?? "Google account"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void signOutUser()}
            className="h-9 shrink-0 gap-2 rounded-full border-rule bg-transparent text-ink-muted shadow-none hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="size-3.5" strokeWidth={2} />
            Sign out
          </Button>
        </CardContent>
      </Card>

      <p className="px-1 text-center text-xs leading-relaxed text-ink-muted">
        Fitflow provides general fitness guidance and is not a substitute for
        medical advice. Consult a healthcare professional before starting a new
        exercise programme, especially if you have an injury or medical
        condition.
      </p>
    </motion.div>
  );
}