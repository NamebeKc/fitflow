// src/lib/chat.ts
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

/**
 * ── CHAT PERSISTENCE ────────────────────────────────────────────────
 * Messages live at users/{uid}/messages/{messageId}, alongside the
 * profile and workout log. Same ownership model, same security rules
 * shape: a user can only ever touch their own subtree.
 *
 * Only completed messages are written — never mid-stream. Writing each
 * fragment would mean hundreds of writes per reply.
 * ─────────────────────────────────────────────────────────────────────
 */

/** How many past messages to load into the transcript. */
export const MAX_STORED_MESSAGES = 60;

export interface StoredMessage {
  id: string;
  role: "user" | "coach";
  content: string;
  /** Hidden from the transcript but still part of the model's context. */
  hidden?: boolean;
  /** ISO timestamp — sorts chronologically as a plain string. */
  createdAt: string;
}

function messagesCollection(uid: string) {
  return collection(db, "users", uid, "messages");
}

/** Loads the most recent messages, oldest first (display order). */
export async function loadMessages(uid: string): Promise<StoredMessage[]> {
  const snapshot = await getDocs(
    query(
      messagesCollection(uid),
      orderBy("createdAt", "desc"),
      limit(MAX_STORED_MESSAGES),
    ),
  );

  return snapshot.docs
    .map((docSnapshot) => docSnapshot.data() as StoredMessage)
    .reverse();
}

/** Appends one completed message. */
export async function saveMessage(
  uid: string,
  message: StoredMessage,
): Promise<void> {
  await setDoc(doc(messagesCollection(uid), message.id), {
    id: message.id,
    role: message.role,
    content: message.content,
    hidden: message.hidden ?? false,
    createdAt: message.createdAt,
  });
}

/**
 * Removes a single message.
 *
 * Used when a request fails: the user's message was already written,
 * but no reply ever will be. Leaving it produces an orphan turn, and
 * the next request then sends two user turns in a row — which the
 * model API rejects, so the conversation stays broken for good.
 * Deleting it keeps the stored transcript alternating.
 */
export async function deleteMessage(
  uid: string,
  messageId: string,
): Promise<void> {
  await deleteDoc(doc(messagesCollection(uid), messageId));
}

/** Deletes the whole conversation. */
export async function clearMessages(uid: string): Promise<void> {
  const snapshot = await getDocs(messagesCollection(uid));
  await Promise.all(
    snapshot.docs.map((docSnapshot) => deleteDoc(docSnapshot.ref)),
  );
}

/** ISO timestamp for a new message. */
export function nowISO(): string {
  return new Date().toISOString();
}