import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/* -------------------------------------------------------------------------- */
/*  better-auth core tables                                                   */
/*                                                                            */
/*  Shape follows better-auth's official Drizzle schema (user / session /     */
/*  account / verification). The emailOTP plugin reuses the `verification`    */
/*  table, so no extra table is needed for OTP.                               */
/*                                                                            */
/*  IMPORTANT: the JS property keys MUST stay camelCase (id, emailVerified,   */
/*  createdAt, …) because the better-auth Drizzle adapter maps its internal   */
/*  field names to these property keys, not to the SQL column names.          */
/* -------------------------------------------------------------------------- */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // old Appwrite `fullName`
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"), // old Appwrite `avatar`
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

/* -------------------------------------------------------------------------- */
/*  Application tables (migration-plan §4)                                     */
/* -------------------------------------------------------------------------- */

export const files = sqliteTable("files", {
  id: text("id").primaryKey(), // uuid
  name: text("name").notNull(),
  type: text("type").notNull(), // document | image | video | audio | other
  extension: text("extension").notNull(),
  size: integer("size").notNull(), // bytes
  r2Key: text("r2_key").notNull(), // object key in R2 (replaces bucketFileId)
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(), // unix ms
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(), // unix ms
});

// Replaces the Appwrite `users` array — correct + queryable share list.
export const fileShares = sqliteTable(
  "file_shares",
  {
    fileId: text("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
  },
  (table) => [primaryKey({ columns: [table.fileId, table.email] })],
);

export const schema = {
  user,
  session,
  account,
  verification,
  files,
  fileShares,
};

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Account = typeof account.$inferSelect;
export type Verification = typeof verification.$inferSelect;
export type FileRow = typeof files.$inferSelect;
export type FileShareRow = typeof fileShares.$inferSelect;
