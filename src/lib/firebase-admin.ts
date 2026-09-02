// src/lib/firebase-admin.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * ── FIREBASE ADMIN (SERVER ONLY) ─────────────────────────────────────
 * Uses a SERVICE ACCOUNT — full admin access to the Firebase project,
 * bypassing Firestore security rules entirely. This module must NEVER
 * be imported from a client component, and its credentials must NEVER
 * be exposed to the browser. Read only from server env vars
 * (.env.local locally; Cloud Run env vars in production).
 *
 * Initialization is lazy (inside the getters, not at module load) so
 * a missing env var fails loudly on first real use rather than
 * crashing unrelated build steps.
 * ─────────────────────────────────────────────────────────────────────
 */

let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

function ensureAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // The env var stores literal "\n" sequences; convert them to real newlines.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, " +
        "FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function getAdminAuth(): Auth {
  if (!cachedAuth) cachedAuth = getAuth(ensureAdminApp());
  return cachedAuth;
}

export function getAdminDb(): Firestore {
  if (!cachedDb) cachedDb = getFirestore(ensureAdminApp());
  return cachedDb;
}