import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * R2 storage helpers.
 *
 * The bucket is exposed through the OpenNext Cloudflare context as the `BUCKET`
 * binding (declared in wrangler.jsonc). Access it lazily inside each helper so
 * the binding is resolved within the request scope (Server Actions / route
 * handlers), never at module load.
 */
function getBucket() {
  const { env } = getCloudflareContext();
  return env.BUCKET;
}

/**
 * Write an object to R2.
 *
 * @param key         object key (e.g. `${ownerId}/${uuid}/${filename}`)
 * @param data        the bytes to store
 * @param contentType optional MIME type, stored as httpMetadata.contentType
 */
export async function putFile(
  key: string,
  data: ArrayBuffer | ReadableStream | Uint8Array,
  contentType?: string,
) {
  return getBucket().put(key, data, {
    httpMetadata: contentType ? { contentType } : undefined,
  });
}

/**
 * Read an object from R2. Returns `null` when the key does not exist.
 * (The authed serving route in Task 4 is the primary consumer.)
 */
export async function getFile(key: string) {
  return getBucket().get(key);
}

/** Delete an object from R2. No-op if the key does not exist. */
export async function deleteObject(key: string) {
  return getBucket().delete(key);
}
