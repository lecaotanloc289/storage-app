import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import { schema } from "./schema";

/**
 * Returns a Drizzle client bound to the D1 database (`DB` binding in
 * wrangler.jsonc). Access the binding through the OpenNext Cloudflare context
 * so it works inside Next.js server code (Server Actions, route handlers, RSC).
 */
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;

export { schema };
export * from "./schema";
