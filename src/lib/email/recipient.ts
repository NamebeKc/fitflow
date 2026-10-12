// src/lib/email/recipient.ts
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";

export interface Recipient {
  uid: string;
  email: string;
  firstName?: string;
}

/**
 * The address and first name to use for a uid, or null.
 *
 * FIREBASE AUTH IS THE SOURCE OF TRUTH for the address, not
 * `billingEmail`. The billing address is whatever was typed into
 * Flutterwave's form — it can be a work address, a partner's, or a
 * typo — whereas the auth record is the one they can actually sign in
 * with and the one every other message in the product goes to.
 *
 * Returns null rather than throwing. A user with no email address is
 * an ordinary state (phone-only sign-in, a deleted auth record), and
 * the right response is to skip them, not to fail the run or the
 * payment that triggered it.
 */
export async function recipientFor(uid: string): Promise<Recipient | null> {
  try {
    const user = await getAdminAuth().getUser(uid);
    if (!user.email) return null;
    const profile = await getAdminDb().collection("users").doc(uid).get();
    const firstName =
      (profile.data()?.firstName as string | undefined) ?? undefined;
    return { uid, email: user.email, firstName };
  } catch {
    return null;
  }
}
