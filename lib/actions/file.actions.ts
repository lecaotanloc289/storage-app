"use server";

import { InputFile } from "node-appwrite/file";
import { createAdminClient, createSessionClient } from "../appwrite";
import { appwriteConfig } from "../appwrite/config";
import { ID, Models, Query } from "node-appwrite";
import { constructFileUrl, getFileType, parseStringify } from "../utils";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./user.actions";

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

export const uploadFile = async ({
  file,
  ownerId,
  accountId,
  path,
}: UploadFileProps) => {
  const { storage, database } = await createAdminClient();
  try {
    const inputFile = InputFile.fromBuffer(file, file.name);
    const bucketFile = await storage.createFile(
      appwriteConfig.storage,
      ID.unique(),
      inputFile,
    );

    const fileDocument = {
      type: getFileType(bucketFile.name).type,
      name: bucketFile.name,
      url: constructFileUrl(bucketFile.$id),
      extension: getFileType(bucketFile.name).extension,
      size: bucketFile.sizeOriginal,
      owner: ownerId,
      ownerId,
      accountId,
      users: [],
      bucketFileId: bucketFile.$id,
    };

    const newFile = await database
      .createDocument(
        appwriteConfig.database,
        appwriteConfig.file_collection,
        ID.unique(),
        fileDocument,
      )
      .catch(async (error: unknown) => {
        await storage.deleteFile(appwriteConfig.storage, bucketFile.$id);
        handleError(error, "Failed to create file document");
      });

    // “Hãy xóa cache của route này, lần request tiếp theo phải chạy lại Server Component”
    // Upload sảy ra ở server, không có router ở đây
    // Không gọi next không biết có dữ liệu mới để get lại.
    // Upload xong dữ liệu ≠ UI biết dữ liệu mới → Phải nói cho Next.js biết cache đã “hết hạn”
    revalidatePath(path);

    return parseStringify(newFile);
  } catch (error) {
    handleError(error, "Failed to upload file");
  }
};
const createQueries = (currentUser: Models.Document) => {
  const queries = [
    Query.or([
      Query.equal("ownerId", currentUser.$id),
      Query.contains("users", currentUser.email),
    ]),
  ];
  // TODO: Search, sort, limits ...

  return queries;
};

export const getFiles = async () => {
  const { database } = await createAdminClient();

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error("User not found");
    }
    const queries = createQueries(currentUser);
    const files = await database.listDocuments(
      appwriteConfig.database,
      appwriteConfig.file_collection,
      queries,
    );
    // Get ownerIds
    const ownerIds = [...new Set(files.documents.map((f) => f.owner))];
    const usersRes = await database.listDocuments(
      appwriteConfig.database,
      appwriteConfig.user_collection,
      [Query.equal("$id", ownerIds)],
    );
    const usersMap = Object.fromEntries(
      usersRes.documents.map((u) => [
        u.$id,
        {
          id: u.$id,
          fullName: u.fullName,
          email: u.email,
          avatar: u.avatar,
        },
      ]),
    );

    const documents = files.documents.map((f) => ({
      ...f,
      owner: usersMap[f.ownerId] || null,
    }));

    return parseStringify({
      ...files,
      documents,
    });
  } catch (error) {
    handleError(error, "Failed to get files");
  }
};

export const renameFile = async ({
  fileId,
  name,
  extension,
  path,
}: RenameFileProps) => {
  const { database } = await createAdminClient();
  try {
    const newName = `${name}.${extension}`;
    const updatedFile = await database.updateDocument(
      appwriteConfig.database,
      appwriteConfig.file_collection,
      fileId,
      { name: newName },
    );
    revalidatePath(path);
    return parseStringify(updatedFile);
  } catch (error) {
    handleError(error, "Failed to rename file");
  }
};

export const updateFileUsers = async ({
  fileId,
  emails,
  path,
}: UpdateFileUsersProps) => {
  const { database } = await createAdminClient();
  try {
    const updatedFile = await database.updateDocument(
      appwriteConfig.database,
      appwriteConfig.file_collection,
      fileId,
      { users: emails },
    );
    revalidatePath(path);
    return parseStringify(updatedFile);
  } catch (error) {
    handleError(error, "Failed to share file");
  }
};

export const deleteFile = async ({
  fileId,
  bucketFileId,
  path,
}: DeleteFileProps) => {
  const { database, storage } = await createAdminClient();
  try {
    const deleteFile = await database.deleteDocument(
      appwriteConfig.database,
      appwriteConfig.file_collection,
      fileId,
    );
    if (deleteFile) {
      await storage.deleteFile(appwriteConfig.storage, bucketFileId);
    }
    revalidatePath(path);
    return parseStringify({ status: "Success" });
  } catch (error) {
    handleError(error, "Failed to delete file");
  }
};