// src/components/layout/Sidebar.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Dumbbell,
  LayoutDashboard,
  TrendingUp,
  LogOut,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfile } from "@/components/providers/ProfileProvider";
import { goalLabel } from "@/lib/profile";

interface NavItem {
  label: string;
  /** Shorter form for the mobile tab bar, where width is scarce. */
  shortLabel: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", shortLabel: "Home", href: "/", icon: LayoutDashboard },
  { label: "AI Coach", shortLabel: "Coach", href: "/coach", icon: Sparkles },
  { label: "Workout Log", shortLabel: "Log", href: "/log", icon: Dumbbell },
  {
    label: "Progress",
    shortLabel: "Progress",
    href: "/progress",
    icon: TrendingUp,
  },
  { label: "Profile", shortLabel: "Profile", href: "/profile", icon: UserRound },
];

/**
 * Application navigation.
 *
 * - `lg+`  : full 16rem rail with logo, labels, and user footer.
 * - `md`   : collapsed 76px icon rail.
 * - `< md` : fixed bottom tab bar — the native pattern for fitness apps.
 *
 * Lime marks exactly one thing: where you are. Everything else stays
 * in the white/40–white/70 range so the accent never competes with
 * itself.
 */
export function Sidebar() {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const { user, signOutUser } = useAuth();
  const { profile, isLoading } = useProfile();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const displayName = profile?.firstName ?? user?.displayName ?? "Athlete";
  const initial = displayName.charAt(0).toUpperCase();
  const subline = profile ? goalLabel(profile.goal) : "Complete your profile";

  return (
    <>
      {/* ── Desktop / tablet rail ─────────────────────────────────── */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col border-r border-white/[0.06] bg-[#0D0F12] md:flex lg:w-64"
        aria-label="Primary"
      >
        {/* The full lockup needs horizontal room, so the collapsed
            76px rail falls back to the mark alone. A brand needs both
            forms precisely for situations like this. */}
        <div className="flex h-16 items-center px-4 lg:px-6">
          <Image
            src="/logo.png"
            alt="AdimFit"
            width={36}
            height={36}
            priority
            className="size-9 lg:hidden"
          />
          <Image
            src="/logo-horizontal.png"
            alt="AdimFit"
            width={1646}
            height={430}
            priority
            className="hidden h-9 w-auto lg:block"
          />
        </div>

        <div className="h-px bg-white/[0.06]" />

        <nav className="flex flex-1 flex-col gap-1.5 px-3 py-6" aria-label="Main">
          <p className="mb-2 hidden px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50 lg:block">
            Menu
          </p>

          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <motion.div
                key={item.href}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50",
                    active ? "text-[#CCFF00]" : "text-white/60 hover:text-white",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active-pill"
                      transition={
                        prefersReducedMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 380, damping: 32 }
                      }
                      className="absolute inset-0 rounded-xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.07]"
                      aria-hidden
                    />
                  )}

                  <Icon
                    className={cn(
                      "relative z-10 size-5 shrink-0 transition-colors",
                      active
                        ? "text-[#CCFF00]"
                        : "text-white/50 group-hover:text-white/80",
                    )}
                    strokeWidth={2}
                  />
                  <span className="relative z-10 hidden lg:inline">
                    {item.label}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 pb-5">
          <div className="mb-4 h-px bg-white/[0.06]" />

          {isLoading ? (
            <div className="flex items-center gap-3 px-2 py-1.5 lg:px-3">
              <Skeleton className="size-9 shrink-0 rounded-full bg-white/[0.06]" />
              <div className="hidden flex-1 space-y-1.5 lg:block">
                <Skeleton className="h-3.5 w-24 rounded bg-white/[0.06]" />
                <Skeleton className="h-3 w-32 rounded bg-white/[0.06]" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/profile"
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 outline-none transition-colors hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 lg:px-3"
              >
                <Avatar className="size-9 border border-white/10">
                  {user?.photoURL && <AvatarImage src={user.photoURL} alt="" />}
                  <AvatarFallback className="bg-[#1F2228] text-xs font-semibold text-[#CCFF00]">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden min-w-0 lg:block">
                  <p className="truncate text-sm font-medium text-white">
                    {displayName}
                  </p>
                  <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-white/50">
                    {subline}
                  </p>
                </div>
              </Link>

              <button
                type="button"
                onClick={() => void signOutUser()}
                aria-label="Sign out"
                className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-white/50 outline-none transition-colors hover:bg-white/[0.06] hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 lg:flex"
              >
                <LogOut className="size-4" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ─────────────────────────────────── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-[#0D0F12]/95 backdrop-blur-md md:hidden"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0.5 font-mono text-[9px] uppercase tracking-[0.04em] outline-none transition-colors active:bg-white/[0.04]",
                  "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#CCFF00]/50",
                  active ? "text-[#CCFF00]" : "text-white/50",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.25 : 2} />
                {item.shortLabel}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}