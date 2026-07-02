"use server";

/*
Auth flow (better-auth + email OTP):
1. User enters full name + email (sign-up) or just email (sign-in).
2. We send a 6-digit OTP to the email via Resend (better-auth `emailOTP` plugin).
3. On sign-in we first check the user exists so we keep the old
   "User not found" UX; sign-up creates the user on verification.
4. User enters the OTP → `verifySecret` verifies it, better-auth creates the
   session and (via the `nextCookies` plugin) sets the session cookie.
5. `getCurrentUser` reads the session and maps it to the shape the UI expects.
*/

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { avatarPlaceholderUrl } from "@/constants";

import { getAuth } from "../auth";
import { getDb } from "../db";
import { user } from "../db/schema";
import { parseStringify } from "../utils";

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

export const getUserByEmail = async (email: string) => {
  const db = getDb();
  const rows = await db.select().from(user).where(eq(user.email, email)).limit(1);
  return rows.length > 0 ? rows[0] : null;
};

export const sendEmailOTP = async ({ email }: { email: string }) => {
  try {
    await getAuth().api.sendVerificationOTP({
      body: { email, type: "sign-in" },
    });
    return parseStringify({ success: true });
  } catch (error) {
    handleError(error, "Failed to send email OTP");
  }
};

export const createAccount = async ({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) => {
  try {
    await getAuth().api.sendVerificationOTP({
      body: { email, type: "sign-in" },
    });
    // `accountId` is kept for UI parity: AuthForm uses its truthiness to open
    // the OTP modal. The real user row is created on verification.
    return parseStringify({ accountId: email });
  } catch (error) {
    handleError(error, "Failed to create account");
  }
};

export const signInUser = async ({ email }: { email: string }) => {
  try {
    const existingUser = await getUserByEmail(email);
    if (!existingUser) {
      return parseStringify({ accountId: null, message: "User not found" });
    }
    await getAuth().api.sendVerificationOTP({
      body: { email, type: "sign-in" },
    });
    return parseStringify({ accountId: email });
  } catch (error) {
    handleError(error, "Failed to sign in user");
  }
};

export const verifySecret = async ({
  email,
  password,
  fullName,
}: {
  email: string;
  password: string; // the OTP code entered by the user
  fullName?: string; // present only for the sign-up flow
}) => {
  try {
    // Verifies the OTP and creates the session. `nextCookies()` (last plugin in
    // lib/auth.ts) auto-applies the Set-Cookie for this server action.
    const result = await getAuth().api.signInEmailOTP({
      body: {
        email,
        otp: password,
        // On first sign-in this creates the user with these fields.
        ...(fullName
          ? { name: fullName, image: avatarPlaceholderUrl }
          : {}),
      },
      headers: await headers(),
    });

    // better-auth emailOTP is email-only; make sure the sign-up full name is
    // persisted onto the user row even if it already existed without a name.
    if (fullName) {
      const db = getDb();
      await db
        .update(user)
        .set({ name: fullName, updatedAt: new Date() })
        .where(eq(user.email, email));
    }

    return parseStringify({ sessionId: result?.token ?? "session" });
  } catch (error) {
    handleError(error, "Failed to verify OTP");
  }
};

export const getCurrentUser = async () => {
  try {
    const session = await getAuth().api.getSession({
      headers: await headers(),
    });
    if (!session?.user) return null;

    const u = session.user;
    // Map better-auth user → the Appwrite-shaped doc the UI depends on.
    return parseStringify({
      $id: u.id,
      accountId: u.id,
      fullName: u.name,
      email: u.email,
      avatar: u.image ?? avatarPlaceholderUrl,
    });
  } catch (error) {
    console.log(error, "Failed to get current user");
    return null;
  }
};

export const signOutUser = async () => {
  try {
    await getAuth().api.signOut({ headers: await headers() });
  } catch (error) {
    console.log(error, "Failed to sign out user");
  }
  redirect("/sign-in");
};
