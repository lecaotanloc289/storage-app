import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";

/**
 * better-auth catch-all handler. The auth instance is built lazily per request
 * (bindings/secrets only exist at request time on Workers), so we resolve the
 * matching Next.js handler inside each method rather than at module top level.
 */
export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
