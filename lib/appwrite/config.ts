export const appwriteConfig = {
  endpointUrl: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!,
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!,
  projectName: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_NAME!,
  database: process.env.NEXT_PUBLIC_APPWRITE_DATABASE!,
  storage: process.env.NEXT_PUBLIC_APPWRITE_STORAGE!,
  secretKey: process.env.NEXT_APPWRITE_SECRET_KEY!,
};
