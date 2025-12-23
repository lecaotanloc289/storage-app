export const appwriteConfig = {
  endpointUrl: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!,
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!,
  projectName: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_NAME!,
  database: process.env.NEXT_PUBLIC_APPWRITE_DATABASE!,
  user_collection: process.env.NEXT_PUBLIC_APPWRITE_USER_COLLECTION!,
  file_collection: process.env.NEXT_PUBLIC_APPWRITE_FILE_COLLECTION!,
  file_storage_collection:
    process.env.NEXT_PUBLIC_APPWRITE_FILE_STORAGE_COLLECTION!,
  storage: process.env.NEXT_PUBLIC_APPWRITE_STORAGE!,
  secretKey: process.env.NEXT_APPWRITE_SECRET_KEY!,
};
