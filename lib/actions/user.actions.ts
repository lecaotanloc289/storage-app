"use server";

// Flow for create account
/* 
1. User enters fullname and email
2. Check if the user already exist using the email (we will use this 
    to identify if we still need to create a user document or not)
3. Send OTP to user's email
4. This will send a secret key for creating a session. The secret key 
    or OPT will be sent to the user's account email. If the user's auth
    account has 
5. Create a new user document if the user is a new user.
6. Return the user's accountId that will be use to complete the login process later with the OTP
7. Verify OTP and authenticate to login
*/

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { appwriteConfig } from "../appwrite/config";
import { parseStringify } from "../utils";
import { cookies } from "next/headers";
import { avatarPlaceholderUrl } from "@/constants";
import { redirect } from "next/navigation";

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

export const getUserByEmail = async (email: string) => {
  const { database } = await createAdminClient();
  const result = await database.listDocuments({
    databaseId: appwriteConfig.database,
    collectionId: "user",
    queries: [Query.equal("email", [email])],
  });
  return result.total > 0 ? result.documents[0] : null;
};

export const sendEmailOTP = async ({ email }: { email: string }) => {
  const { account } = await createAdminClient();
  try {
    const session = await account.createEmailToken(ID.unique(), email);
    return session.userId;
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
  const existingUser = await getUserByEmail(email);
  const accountId = await sendEmailOTP({ email });
  if (!accountId) throw new Error("Failed to send an OTP");
  if (!existingUser) {
    const { database } = await createAdminClient();
    await database.createDocument({
      databaseId: appwriteConfig.database,
      collectionId: "user",
      documentId: ID.unique(),
      data: {
        fullName,
        email,
        avatar: avatarPlaceholderUrl,
        accountId,
      },
    });
  }
  return parseStringify({ accountId });
};

export const verifySecret = async ({
  accountId,
  password,
}: {
  accountId: string;
  password: string;
}) => {
  try {
    const { account } = await createAdminClient();
    const session = await account.createSession(accountId, password);
    (await cookies()).set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });
    return parseStringify({ sessionId: session.$id });
  } catch (error) {
    handleError(error, "Failed to verify OTP");
  }
};

export const getCurrentUser = async () => {
  try {
    const { database, account } = await createSessionClient();
    const result = await account.get();
    const user = await database.listDocuments({
      databaseId: appwriteConfig.database,
      collectionId: "user",
      queries: [Query.equal("accountId", [result.$id])],
    });

    if (user.total <= 0) return null;
    return parseStringify(user.documents[0]);
  } catch (error) {
    handleError(error, "Failed to get current user");
  }
  
};

export const signOutUser = async () => {
  const { account } = await createAdminClient();
  try {
    await account.deleteSession("current");
    (await cookies()).delete("appwrite-session");
  } catch (error) {
    handleError(error, "Failed to sign out user");
  } finally {
    redirect("/sign-in");
  }
};

export const signInUser = async ({ email }: { email: string }) => {
  try {
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      const accountId = await sendEmailOTP({ email });
      return parseStringify({ accountId });
    }
    return parseStringify({ accountId: null, message: "User not found" });
  } catch (error) {
    handleError(error, "Failed to sign in user");
  }
};