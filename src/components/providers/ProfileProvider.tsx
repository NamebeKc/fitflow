// src/components/providers/ProfileProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import {
  loadProfile,
  saveProfile,
  type UserProfile,
} from "@/lib/profile";

/**
 * App-wide profile state, now sourced from Firestore.
 *
 * The provider watches the auth state: when a user signs in, their
 * profile is fetched from `users/{uid}`; on sign-out it clears.
 * `updateProfile` writes to Firestore and updates local state, so all
 * subscribers (sidebar, profile page) refresh instantly.
 */
interface ProfileContextValue {
  profile: UserProfile | null;
  /** True while the profile for the current user is being fetched. */
  isLoading: boolean;
  updateProfile: (profile: UserProfile) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Signed out (or auth still resolving): no profile to load.
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    loadProfile(user.uid).then((loaded) => {
      if (cancelled) return; // user changed mid-fetch; ignore stale result
      setProfile(loaded);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function updateProfile(next: UserProfile) {
    if (!user) return;
    await saveProfile(user.uid, next);
    setProfile(next);
  }

  return (
    <ProfileContext.Provider value={{ profile, isLoading, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

/** Hook for consuming the profile anywhere under the provider. */
export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used inside <ProfileProvider>");
  }
  return context;
}