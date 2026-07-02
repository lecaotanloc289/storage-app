"use server";

import { and, asc, desc, eq, inArray, like, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "../db";
import { files, fileShares, user } from "../db/schema";
import type { FileRow, User } from "../db/schema";
import { toFileDoc } from "../mappers";
import { deleteObject, putFile } from "../storage";
import { getFileType, parseStringify } from "../utils";
import { getCurrentUser } from "./user.actions";

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

export const uploadFile = async ({
  file,
  ownerId,
  path,
}: UploadFileProps) => {
  const db = getDb();
  const { type, extension } = getFileType(file.name);
  const r2Key = `${ownerId}/${crypto.randomUUID()}/${file.name}`;

  try {
    // 1. Write bytes to R2 first so we never persist a row without an object.
    await putFile(r2Key, await file.arrayBuffer(), file.type);

    const now = new Date();
    const row: FileRow = {
      id: crypto.randomUUID(),
      name: file.name,
      type,
      extension,
      size: file.size,
      r2Key,
      ownerId,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.insert(files).values(row);
    } catch (dbError) {
      // Roll back the orphaned R2 object if the DB insert fails.
      await deleteObject(r2Key).catch(() => {});
      throw dbError;
    }

    revalidatePath(path);
    return parseStringify(toFileDoc(row));
  } catch (error) {
    handleError(error, "Failed to upload file");
  }
};

/** Map a sort field from the UI (`$createdAt-desc`, `name-asc`, …) to a column. */
const sortColumn = (sortBy: string) => {
  switch (sortBy) {
    case "$updatedAt":
      return files.updatedAt;
    case "name":
      return files.name;
    case "size":
      return files.size;
    case "$createdAt":
    default:
      return files.createdAt;
  }
};

export const getFiles = async ({
  types = [],
  searchText = "",
  sort = "$createdAt-desc",
  limit,
}: GetFilesProps) => {
  const db = getDb();

  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      throw new Error("User not found");
    }

    // owner OR shared-via-file_shares (migration-plan §4).
    const sharedFileIds = db
      .select({ id: fileShares.fileId })
      .from(fileShares)
      .where(eq(fileShares.email, currentUser.email));

    const conditions = [
      or(eq(files.ownerId, currentUser.$id), inArray(files.id, sharedFileIds)),
    ];
    if (types.length > 0) conditions.push(inArray(files.type, types));
    if (searchText) conditions.push(like(files.name, `%${searchText}%`));

    const [sortBy, orderBy] = sort.split("-");
    const orderExpr =
      orderBy === "asc" ? asc(sortColumn(sortBy)) : desc(sortColumn(sortBy));

    const baseQuery = db
      .select()
      .from(files)
      .where(and(...conditions))
      .orderBy(orderExpr);

    const rows = limit ? await baseQuery.limit(limit) : await baseQuery;

    // Batch-fetch owner users so each doc carries a populated `owner` object.
    const ownerIds = [...new Set(rows.map((r) => r.ownerId))];
    const ownerRows: User[] =
      ownerIds.length > 0
        ? await db.select().from(user).where(inArray(user.id, ownerIds))
        : [];
    const ownerMap = new Map(ownerRows.map((u) => [u.id, u]));

    // Batch-fetch shared emails for the returned files.
    const fileIds = rows.map((r) => r.id);
    const shareRows =
      fileIds.length > 0
        ? await db
            .select()
            .from(fileShares)
            .where(inArray(fileShares.fileId, fileIds))
        : [];
    const sharesMap = new Map<string, string[]>();
    for (const s of shareRows) {
      const list = sharesMap.get(s.fileId) ?? [];
      list.push(s.email);
      sharesMap.set(s.fileId, list);
    }

    const documents = rows.map((r) =>
      toFileDoc(r, ownerMap.get(r.ownerId) ?? null, sharesMap.get(r.id) ?? []),
    );

    return parseStringify({ documents, total: documents.length });
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
  const db = getDb();
  try {
    const newName = `${name}.${extension}`;
    const updated = await db
      .update(files)
      .set({ name: newName, updatedAt: new Date() })
      .where(eq(files.id, fileId))
      .returning();

    revalidatePath(path);
    return parseStringify(toFileDoc(updated[0]));
  } catch (error) {
    handleError(error, "Failed to rename file");
  }
};

export const updateFileUsers = async ({
  fileId,
  emails,
  path,
}: UpdateFileUsersProps) => {
  const db = getDb();
  try {
    // Replace the share list: drop existing rows, insert the new emails.
    await db.delete(fileShares).where(eq(fileShares.fileId, fileId));

    const cleaned = [...new Set(emails.map((e) => e.trim()).filter(Boolean))];
    if (cleaned.length > 0) {
      await db
        .insert(fileShares)
        .values(cleaned.map((email) => ({ fileId, email })));
    }

    const rows = await db.select().from(files).where(eq(files.id, fileId));
    revalidatePath(path);
    return parseStringify(toFileDoc(rows[0], null, cleaned));
  } catch (error) {
    handleError(error, "Failed to share file");
  }
};

export const deleteFile = async ({
  fileId,
  bucketFileId,
  path,
}: DeleteFileProps) => {
  const db = getDb();
  try {
    // Cascade (file_shares.file_id ON DELETE CASCADE) removes the share rows.
    await db.delete(files).where(eq(files.id, fileId));
    await deleteObject(bucketFileId);

    revalidatePath(path);
    return parseStringify({ status: "Success" });
  } catch (error) {
    handleError(error, "Failed to delete file");
  }
};

// ============================== TOTAL FILE SPACE USED
export async function getTotalSpaceUsed() {
  const db = getDb();
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("User is not authenticated.");

    const rows = await db
      .select()
      .from(files)
      .where(eq(files.ownerId, currentUser.$id));

    const totalSpace = {
      image: { size: 0, latestDate: "" },
      document: { size: 0, latestDate: "" },
      video: { size: 0, latestDate: "" },
      audio: { size: 0, latestDate: "" },
      other: { size: 0, latestDate: "" },
      used: 0,
      all: 2 * 1024 * 1024 * 1024 /* 2GB available bucket storage */,
    };

    rows.forEach((file) => {
      const fileType = file.type as FileType;
      const bucket = totalSpace[fileType] ?? totalSpace.other;
      const updatedAt = new Date(file.updatedAt).toISOString();

      bucket.size += file.size;
      totalSpace.used += file.size;

      if (
        !bucket.latestDate ||
        new Date(updatedAt) > new Date(bucket.latestDate)
      ) {
        bucket.latestDate = updatedAt;
      }
    });

    return parseStringify(totalSpace);
  } catch (error) {
    handleError(error, "Error calculating total space used:, ");
  }
}
