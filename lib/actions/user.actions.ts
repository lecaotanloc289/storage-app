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
import { createAdminClient } from "../appwrite";
import { appwriteConfig } from "../appwrite/config";
import { parseStringify } from "../utils";
import { cookies } from "next/headers";

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

const getUserByEmail = async (email: string) => {
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
        avatar:
          "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBwoNEA8NDQ4NDQ0NDQ4NCA0NDQ8NDQ8PFREWFhURFRYYHSggGBolHRUTITEhJSkrLi4uFx8zRDMvNygtLisBCgoKDQ0NFQ0NDysZFRkrKy0rKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrK//AABEIAOAA4QMBIgACEQEDEQH/xAAaAAEBAAMBAQAAAAAAAAAAAAAAAQMEBQIH/8QAMBABAQABAgIHBwQDAQAAAAAAAAECAwQRMRIhQVFxkdEUIjJhgaHBQlKCsWJy8AX/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/APreKpFAAAAAAAAAAAAAAAAAAAAAAAAAAAABIqRQAAAAAAAAAAAAAAAAAAAAAAAAAAAASKkUAAAAAAALXm0HrinFADicQAABZV4vID0JKvEAAAAAAAAAAHmPSRQAAAACiUEAABk0tHLPly7beQMY3sNphOfHL7Rlmhp/tx8oDmDp3R0/24+UY89pp3lxngDQGXW2+WHXznfGIBUAeoJKoAAAAAAAAJFSKAAAABXmrUAABl2+j078pz9HRxxk6p1TseNHT6OMnb+rxZAAAAALGhutDo9c+G/at95zxmUsvKg5QuUstl5y8KgD1HmLKCgAAAAAAAkV5j0AAAACVCgDJt8eOWPjx8mNn2U97+NBvqAAAAAAAOfvMeGXjJWBtb+dePhfw1QFRRFAFAAAAAASKkUAAAAHmhQBsbH4r/rf7jXZtplwynz6gdESKAAAAAADT/8AQ/T9fw1Gzvsve4d0awCooigCgAAAAAJFSKAAAACVFqALLw/CAOpp5zKSztj20NprdG9G8ry+VbwKAAAAlsnXeU66rT3ut+ifz9Aa2pl0rb315ABUUFAAAAAAABIqRQAAEOKcQKAACANrbbnh7uXLsvc1QHWll651zsVysM8seVs8GabzU+V8YDfOLQu81P8AGfSsWpqZ5fFbfl2A2txu5yw6725d3g00AUABUAepR5epQAAAAAASK8x64gJQoJaAADNo7fLPr5Tv9AYXvHSzvLG/1G/p6GGPKcb33rrKDnzZ6nyn1PY9Tvx876OgA5/sWp34+d9D2LU78fO+joAOf7Fqd+PnfQ9i1O/Hzvo6ADn+x6nfj530PY9T/HzdABzMtDUnPG/Tr/pjddj1NHDLnPryoOYNjW2uWPXPen3a4CoA9SiLKACcQXiJxUEgiggAAM+00eleleU+9B72224+9lOr9M9W5FAAAAAAAAAAAAAGrudtx97Hn2zvbQDkDb3mjw9+fz9WoAqALxAEAAQAUABcZbZJzt4R09PCYySdjT2WHHLj+2fe/wDVvgAAAAAAAAAAAAAAAAlkvVeV5uXq4dG2d3LwdVp7/Dll9L+PyDUABRFEAAQAUABu7GdVvffw2mvsvh+tbAAAAAAAAAAAAAAAAADBvJxwvysv3Z2LdfBl4A5oAAAAAAAAAN/ZfD9a2Grscuq4914toAAAAAAAAAAAAAAAABi3PwZeDK197nwx4duVkgNAAAAAAH//2Q==",
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
