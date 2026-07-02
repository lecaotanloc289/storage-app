import { avatarPlaceholderUrl } from "@/constants";

import type { FileRow, User } from "./db/schema";
import { constructFileUrl } from "./utils";

/**
 * Compatibility mapping layer (migration-plan §4).
 *
 * The frontend was written against Appwrite document shapes (`$id`,
 * `$createdAt`, `$updatedAt`, a populated `owner` object, `bucketFileId`,
 * `users[]`). Rather than rewrite every component, the actions layer maps D1
 * rows back onto that shape via these helpers.
 */

/** Coerce a D1 timestamp (Date | number ms | ISO string) to an ISO string. */
const toISO = (value: Date | number | string): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  return new Date(value).toISOString();
};

export interface OwnerDoc {
  id: string;
  $id: string;
  fullName: string;
  email: string;
  avatar: string;
}

/** Map a better-auth `user` row onto the owner object the UI reads. */
export const toOwnerDoc = (u: User): OwnerDoc => ({
  id: u.id,
  $id: u.id,
  fullName: u.name,
  email: u.email,
  avatar: u.image ?? avatarPlaceholderUrl,
});

/**
 * Map a better-auth `user` row onto the Appwrite-shaped user doc used across
 * the app (`$id`, `accountId`, `fullName`, `email`, `avatar`). Mirrors the
 * mapping already done inline in `getCurrentUser`.
 */
export const toUserDoc = (u: User) => ({
  $id: u.id,
  accountId: u.id,
  fullName: u.name,
  email: u.email,
  avatar: u.image ?? avatarPlaceholderUrl,
});

/**
 * Map a `files` row onto the Appwrite-shaped file document the UI expects.
 *
 * @param row   the D1 files row
 * @param owner populated owner user row (→ owner object) — omit to fall back to
 *              the raw `ownerId` string
 * @param users shared emails from `file_shares` for this file
 */
export const toFileDoc = (
  row: FileRow,
  owner?: User | null,
  users: string[] = [],
) => ({
  $id: row.id,
  $createdAt: toISO(row.createdAt),
  $updatedAt: toISO(row.updatedAt),
  name: row.name,
  type: row.type,
  extension: row.extension,
  size: row.size,
  bucketFileId: row.r2Key,
  url: constructFileUrl(row.r2Key),
  owner: owner ? toOwnerDoc(owner) : row.ownerId,
  ownerId: row.ownerId,
  users,
});

export type FileDoc = ReturnType<typeof toFileDoc>;
