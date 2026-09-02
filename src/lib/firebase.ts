// src/lib/firebase.ts
import { getApps, initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * ── FIREBASE INITIALIZATION ──────────────────────────────────────────
 * PASTE YOUR OWN CONFIG below — from Firebase console → Project
 * settings → Your apps → fitflow-web. Replace every "PASTE_..." value.
 *
 * These values are PUBLIC identifiers (they tell the SDK which project
 * to talk to), not secrets — every Firebase web app ships them in its
 * code. Your data is protected by Firestore security rules and Auth,
 * not by hiding these strings.
 * ─────────────────────────────────────────────────────────────────────
 */
const firebaseConfig = {
  apiKey: "AIzaSyDbn_1RLlpj8q_0IXvHziqLwO7_VTbVDFs",
 authDomain: "gen-lang-client-0453085520.firebaseapp.com",
  projectId: "gen-lang-client-0453085520",
  storageBucket: "gen-lang-client-0453085520.firebasestorage.app",
  messagingSenderId: "31626096568",
  appId: "1:31626096568:web:8a6fd9be146eeb0dd2a94d",
};

// Next.js can evaluate modules more than once; only initialize once.
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();