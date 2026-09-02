// src/components/providers/AuthProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  fetchSignInMethodsForEmail,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";

import { auth, googleProvider } from "@/lib/firebase";
import { track } from "@/lib/analytics";

/**
 * App-wide authentication state.
 *
 * Firebase persists the session in the browser, so `onAuthStateChanged`
 * fires once on load with either the remembered user or null — that
 * first fire is what ends `isLoading`.
 *
 * Two credential paths are supported: Google popup, and email +
 * password. The email path requires the Email/Password provider to be
 * enabled in the Firebase console; without it every attempt fails with
 * `auth/operation-not-allowed`.
 *
 * The email actions RETURN an error string rather than swallowing it,
 * because a sign-up form has to tell the person what went wrong.
 */
interface AuthContextValue {
  user: User | null;
  /** True until Firebase reports the initial auth state. */
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  /** Resolves to null on success, or a human-readable error message. */
  signUpWithEmail: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<string | null>;
  /** Resolves to null on success, or a human-readable error message. */
  signInWithEmail: (email: string, password: string) => Promise<string | null>;
  /** Sends a reset link. Resolves to null on success, or an error. */
  sendPasswordReset: (email: string) => Promise<string | null>;
  /**
   * Which methods this email can sign in with. Used to explain the
   * commonest failure: an account created with Google being offered a
   * password form that will never work for it.
   */
  checkSignInMethods: (email: string) => Promise<string[]>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Turns Firebase's error codes into something worth showing a person. */
function readableAuthError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  switch (code) {
    case "auth/email-already-in-use":
      return "That email already has an account. Try signing in instead.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/weak-password":
      return "Passwords need to be at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Email or password is incorrect.";
    case "auth/user-not-found":
      return "No account found for that email. Create one instead?";
    case "auth/missing-password":
      return "Enter your password to continue.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/operation-not-allowed":
      return "Email sign-in isn't enabled for this project yet.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signInWithGoogle() {
    try {
      const credential = await signInWithPopup(auth, googleProvider);

      // A single Google button serves both signup and sign-in, so the
      // click alone can't tell them apart. Firebase reports which one
      // actually happened, and the activation funnel depends on the
      // distinction being right.
      const isNewUser = getAdditionalUserInfo(credential)?.isNewUser ?? false;
      track(isNewUser ? "signup_completed" : "signin_completed", {
        method: "google",
      });
    } catch (error) {
      // Most common: the user closed the popup, or double-clicked and
      // cancelled the first request — nothing to handle.
      console.error("Google sign-in failed:", error);
    }
  }

  async function signUpWithEmail(
    email: string,
    password: string,
    name?: string,
  ): Promise<string | null> {
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );
      if (name?.trim()) {
        await updateProfile(credential.user, { displayName: name.trim() });
      }
      return null;
    } catch (error) {
      console.error("Email sign-up failed:", error);
      return readableAuthError(error);
    }
  }

  async function signInWithEmail(
    email: string,
    password: string,
  ): Promise<string | null> {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      return null;
    } catch (error) {
      console.error("Email sign-in failed:", error);
      return readableAuthError(error);
    }
  }

  /**
   * Sends a password reset email.
   *
   * Deliberately reports success even when no account exists. Telling a
   * stranger whether an email is registered turns the form into an
   * account-enumeration tool, and the person who owns the address loses
   * nothing — they simply get no email.
   */
  async function sendPasswordReset(email: string): Promise<string | null> {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return null;
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      // Not an error worth surfacing — see note above.
      if (code === "auth/user-not-found") return null;
      console.error("Password reset failed:", error);
      return readableAuthError(error);
    }
  }

  async function checkSignInMethods(email: string): Promise<string[]> {
    try {
      return await fetchSignInMethodsForEmail(auth, email.trim());
    } catch (error) {
      console.error("Could not check sign-in methods:", error);
      return [];
    }
  }

  async function signOutUser() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        sendPasswordReset,
        checkSignInMethods,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Hook for consuming auth state anywhere under the provider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}