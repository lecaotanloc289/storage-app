import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

export default defineCloudflareConfig({
  // Uses the Workers KV namespace bound as `NEXT_INC_CACHE_KV` (see wrangler.jsonc)
  // for Next.js incremental (ISR/data) cache.
  incrementalCache: kvIncrementalCache,
});
