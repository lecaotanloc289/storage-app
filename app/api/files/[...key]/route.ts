import { and, eq } from "drizzle-orm";
import { type NextRequest } from "next/server";

import { getDb } from "@/lib/db";
import { files, fileShares } from "@/lib/db/schema";
import { getFile } from "@/lib/storage";
import { getCurrentUser } from "@/lib/actions/user.actions";

// This route reads R2 (a per-request binding), so it must never be statically
// evaluated or cached at the framework level.
export const dynamic = "force-dynamic";

/** Minimal extension → MIME fallback for objects stored without contentType. */
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json",
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  zip: "application/zip",
};

const inferContentType = (name: string): string => {
  const ext = name.split(".").pop()?.toLowerCase();
  return (ext && MIME_BY_EXT[ext]) || "application/octet-stream";
};

/**
 * Build an RFC 6266 Content-Disposition value that survives spaces / unicode:
 * an ASCII-safe `filename` plus a UTF-8 `filename*`.
 */
const contentDisposition = (disposition: "inline" | "attachment", name: string) => {
  const fallback = name.replace(/["\\\r\n]/g, "_");
  const encoded = encodeURIComponent(name);
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
};

/**
 * GET /api/files/<ownerId>/<uuid>/<filename>[?download=1]
 *
 * Streams a private R2 object after enforcing an owner-or-shared ACL.
 * The `[...key]` catch-all captures the slash-separated R2 key; each segment is
 * URL-encoded on the client (see `constructFileUrl`) and decoded here.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;

  // Reconstruct the full R2 key from the catch-all segments.
  const key = segments.map((segment) => decodeURIComponent(segment)).join("/");

  // 1. Authenticate.
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Resolve the file row by its R2 key.
  const db = getDb();
  const rows = await db
    .select()
    .from(files)
    .where(eq(files.r2Key, key))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return new Response("Not Found", { status: 404 });
  }

  // 3. ACL: owner, or an explicit share for this user's email.
  const isOwner = row.ownerId === user.$id;
  let allowed = isOwner;
  if (!allowed) {
    const shared = await db
      .select({ email: fileShares.email })
      .from(fileShares)
      .where(and(eq(fileShares.fileId, row.id), eq(fileShares.email, user.email)))
      .limit(1);
    allowed = shared.length > 0;
  }
  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  // 4. Fetch the object from R2 and stream its body.
  const object = await getFile(key);
  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  const responseHeaders = new Headers();
  // Copies Content-Type / Content-Encoding / Cache-Control etc. that R2 stored.
  object.writeHttpMetadata(responseHeaders);
  if (!responseHeaders.has("content-type")) {
    responseHeaders.set(
      "content-type",
      object.httpMetadata?.contentType ?? inferContentType(row.name),
    );
  }
  responseHeaders.set("content-length", String(object.size));
  responseHeaders.set("etag", object.httpEtag);
  // Authed, per-user content: keep it out of shared caches.
  responseHeaders.set("cache-control", "private, max-age=3600");

  const download =
    request.nextUrl.searchParams.has("download") &&
    request.nextUrl.searchParams.get("download") !== "0";
  responseHeaders.set(
    "content-disposition",
    contentDisposition(download ? "attachment" : "inline", row.name),
  );

  return new Response(object.body, { status: 200, headers: responseHeaders });
}
