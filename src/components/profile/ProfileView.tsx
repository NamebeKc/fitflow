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
      <Card className="border-white/[0.07] bg-[#14161A] text-white shadow-none">
        {/* ── Identity header ───────────────────────────────────────── */}
        <CardHeader className="flex flex-row items-center gap-3 pb-5 sm:gap-4">
          <Avatar className="size-12 shrink-0 border border-white/10 sm:size-14">
            {user?.photoURL && <AvatarImage src={user.photoURL} alt="" />}
            <AvatarFallback className="bg-[#1F2228] text-lg font-semibold text-[#CCFF00]">
              {profile.firstName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-[-0.02em] text-white sm:text-xl">
              {profile.firstName}
            </h2>
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-white/50">
              Member since {memberSince}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="h-9 shrink-0 gap-2 rounded-full border-white/10 bg-transparent px-3 text-white/70 shadow-none hover:border-[#CCFF00]/30 hover:bg-white/[0.04] hover:text-white sm:px-4"
          >
            <Pencil className="size-3.5" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ── Key stats ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3.5 sm:p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
                Age
              </p>
              <p className="mt-2 font-mono text-2xl tabular-nums text-white">
                {profile.age}
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3.5 sm:p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/50">
                Weight
              </p>
              <p className="mt-2 font-mono text-2xl tabular-nums text-white">
                {profile.weightKg}
                <span className="ml-1 text-sm text-white/50">kg</span>
              </p>
            </div>

            <div className="col-span-2 rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.05] p-3.5 sm:col-span-1 sm:p-4">
              <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[#CCFF00]/70">
                <Target className="size-3" strokeWidth={2.5} />
                {profileGoals(profile).length > 1 ? "Goals" : "Goal"}
              </p>
              <p className="mt-2 text-sm font-semibold leading-snug text-white">
                {profileGoals(profile).map(goalLabel).join(" + ") || "Not set"}
              </p>
            </div>
          </div>

          <Separator className="bg-white/[0.06]" />

          {/* ── Preferred activities ────────────────────────────────── */}
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
              Preferred activities
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.activities.map((activity) => (
                <span
                  key={activity}
                  className="rounded-full border border-white/[0.07] bg-black/30 px-3.5 py-1.5 text-sm font-medium text-white/60"
                >
                  {activityLabel(activity)}
                </span>
              ))}
            </div>
          </div>

          {/* ── Where they train ────────────────────────────────────── */}
          {profile.environment && profile.environment.length > 0 && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                Training environment
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.environment.map((environment) => (
                  <span
                    key={environment}
                    className="rounded-full border border-white/[0.07] bg-black/30 px-3.5 py-1.5 text-sm font-medium text-white/60"
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
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                Equipment
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.equipment.map((equipment) => (
                  <span
                    key={equipment}
                    className="rounded-full border border-white/[0.07] bg-black/30 px-3.5 py-1.5 text-sm font-medium text-white/60"
                  >
                    {equipmentLabel(equipment)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.coachingStyle && (
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                Coaching style
              </p>
              <span className="inline-block rounded-full border border-white/[0.07] bg-black/30 px-3.5 py-1.5 text-sm font-medium text-white/60">
                {coachingStyleLabel(profile.coachingStyle)}
              </span>
            </div>
          )}

          <p className="text-xs leading-relaxed text-white/50">
            Your coach references this profile when planning sessions. It syncs
            privately to your account and is available on every device you sign
            in from.
          </p>
        </CardContent>
      </Card>

      {/* ── Account ───────────────────────────────────────────────── */}
      <Card className="border-white/[0.07] bg-[#14161A] text-white shadow-none">
        <CardContent className="flex items-center gap-3 p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">Signed in</p>
            <p className="truncate text-sm text-white/50">
              {user?.email ?? "Google account"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void signOutUser()}
            className="h-9 shrink-0 gap-2 rounded-full border-white/10 bg-transparent text-white/60 shadow-none hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="size-3.5" strokeWidth={2} />
            Sign out
          </Button>
        </CardContent>
      </Card>

      <p className="px-1 text-center text-xs leading-relaxed text-white/50">
        Fitflow provides general fitness guidance and is not a substitute for
        medical advice. Consult a healthcare professional before starting a new
        exercise programme, especially if you have an injury or medical
        condition.
      </p>
    </motion.div>
  );
}