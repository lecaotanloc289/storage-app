import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { Resend } from "resend";

import { getDb } from "./db";
import { schema } from "./db/schema";

/**
 * Extra runtime secrets that live on the Worker `env` but are NOT declared in
 * the generated `CloudflareEnv` type (they are `wrangler secret` / `.dev.vars`
 * values, not `wrangler.jsonc` bindings). We read them through the Cloudflare
 * context rather than hardcoding anything.
 */
type AuthEnv = CloudflareEnv & {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
};

/**
 * Builds the better-auth instance for the CURRENT request.
 *
 * On Workers every binding (D1, secrets) is only available per-request via the
 * OpenNext Cloudflare context, so we must NOT instantiate better-auth at module
 * top level (the `DB` binding does not exist at build time). Each call is cheap
 * and scoped to the in-flight request.
 */
export function getAuth() {
  const { env } = getCloudflareContext();
  const authEnv = env as AuthEnv;
  const db = getDb();

  return betterAuth({
    secret: authEnv.BETTER_AUTH_SECRET,
    baseURL: authEnv.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema,
    }),
    // This app authenticates exclusively through email OTP.
    emailAndPassword: { enabled: false },
    plugins: [
      emailOTP({
        // 6-digit code, 5-minute expiry (better-auth defaults, made explicit).
        otpLength: 6,
        expiresIn: 300,
        async sendVerificationOTP({ email, otp }) {
          const resend = new Resend(authEnv.RESEND_API_KEY);
          await resend.emails.send({
            from: authEnv.EMAIL_FROM,
            to: email,
            subject: "Your StoreIt verification code",
            html: `
              <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#333">
                <h2 style="margin:0 0 8px;color:#FA7275">StoreIt</h2>
                <p style="margin:0 0 16px">Use the code below to finish signing in. It expires in 5 minutes.</p>
                <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:0 0 16px;color:#111">${otp}</p>
                <p style="margin:0;color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
              </div>
            `,
          });
        },
      }),
      // MUST be last: auto-applies Set-Cookie from server actions / route handlers.
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof getAuth>;
