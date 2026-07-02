import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side better-auth client. `baseURL` defaults to the current origin,
 * which matches the API route mounted at `/api/auth/[...all]`.
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});
