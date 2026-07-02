# Migration Tasks — step by step

Execution rules for the later phase:

- **One subagent per task, in order.** Tasks are dependency-ordered (0 → 8).
- Each task: add/modify only its listed files, then **commit** with the given
  English Conventional-Commit message.
- **Always commit + push to `dev`.** Never push `prod` — the user merges
  `dev → prod` manually to trigger CI/CD.
- Do **not** create Cloudflare resources from code. Real resource IDs are filled
  into `wrangler.jsonc` by the user (see `docs/deployment-keys.md`); use clearly
  marked `PLACEHOLDER` values so the build still parses.
- After each task, run `pnpm build` (and `pnpm exec opennextjs-cloudflare build`
  from Task 0 on) to keep the tree green before committing.
- Do **not** read `.env.local`.

---

## Task 0 — Cloudflare/OpenNext build baseline

**Goal:** make the repo build & deploy as a Worker (no logic changes yet).

**Add / change:**
- `package.json` — add deps `@opennextjs/cloudflare`, `wrangler` (dev),
  `@cloudflare/workers-types` (dev); add scripts:
  `"preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview"`,
  `"deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"`,
  `"cf-typegen": "wrangler types --env-interface CloudflareEnv"`.
- `wrangler.jsonc` — `main` = `.open-next/worker.js`, `compatibility_date`
  ≥ `2024-09-23`, `compatibility_flags: ["nodejs_compat"]`, assets binding,
  placeholder `d1_databases` (`DB`), `r2_buckets` (`BUCKET`), `kv_namespaces`
  (`NEXT_INC_CACHE_KV`).
- `open-next.config.ts` — default cloudflare config; wire KV incremental cache.
- `.dev.vars` (gitignored) example → add `.dev.vars.example` instead.
- `next.config.ts` — keep as-is; add `initOpenNextCloudflareForDev()` in
  `next.config` per OpenNext docs so `next dev` sees bindings.
- `cloudflare-env.d.ts` — generated env interface (run `cf-typegen`).
- `.gitignore` — add `.open-next/`, `.dev.vars`, `.wrangler/`.

**Acceptance:** `pnpm exec opennextjs-cloudflare build` succeeds.
**Commit:** `build: add Cloudflare Workers deploy via OpenNext adapter`

---

## Task 1 — D1 + Drizzle schema & migrations

**Goal:** database layer scaffolding (no app wiring yet).

**Add / change:**
- deps: `drizzle-orm`, `drizzle-kit` (dev).
- `drizzle.config.ts` — dialect `sqlite`, driver `d1-http` or local, out `drizzle/`.
- `lib/db/schema.ts` — Drizzle tables: `files`, `file_shares`, plus better-auth
  tables (`user`, `session`, `account`, `verification`) — see `migration-plan.md` §4.
- `lib/db/index.ts` — `getDb()` helper returning `drizzle(env.DB, { schema })`.
- `drizzle/0000_init.sql` — generated migration (`drizzle-kit generate`).

**Acceptance:** `pnpm exec drizzle-kit generate` produces a migration; `pnpm build` green.
**Commit:** `feat(db): add D1 Drizzle schema and initial migration`

---

## Task 2 — Auth: better-auth + email OTP (Resend)

**Goal:** replace Appwrite auth end to end.

**Add / change:**
- deps: `better-auth`, `resend`.
- `lib/auth.ts` — `betterAuth({ database: drizzleAdapter(D1), plugins: [emailOTP({ sendVerificationOTP })] })`;
  `sendVerificationOTP` sends via Resend (`EMAIL_FROM`, `RESEND_API_KEY`).
- `lib/auth-client.ts` — `createAuthClient` with `emailOTPClient()` for the browser.
- `app/api/auth/[...all]/route.ts` — mount better-auth handler.
- Rewrite `lib/actions/user.actions.ts`:
  - `sendEmailOTP` → `auth.api.sendVerificationOTP`
  - `createAccount` / `signInUser` → send OTP; create user on verify
  - `verifySecret` → `auth.api.signInEmailOTP` (sets better-auth session cookie)
  - `getCurrentUser` → `auth.api.getSession`, mapped via `toUserDoc()`
  - `signOutUser` → `auth.api.signOut` + redirect
- Update `components/OTPModal.tsx` / `components/AuthForm.tsx` only if the
  action signatures changed (keep names/returns stable to minimize churn).
- Remove `appwrite-session` cookie usage.

**Acceptance:** sign-up → OTP email → verify → session cookie set → `/` loads.
**Commit:** `feat(auth): replace Appwrite auth with better-auth email OTP`

---

## Task 3 — Database: file actions on D1/Drizzle

**Goal:** replace Appwrite Databases in file actions.

**Add / change:**
- Rewrite `lib/actions/file.actions.ts` using Drizzle: `uploadFile` (see Task 4
  for R2), `getFiles` (query translation, `migration-plan.md` §4), `renameFile`,
  `updateFileUsers` (write `file_shares`), `deleteFile`, `getTotalSpaceUsed`.
- `lib/mappers.ts` — `toFileDoc()` / `toUserDoc()` returning `$id`, `$createdAt`,
  `$updatedAt`, `owner` object, `bucketFileId`, `users[]` for frontend parity.
- `index.d.ts` — adjust `FileDocument` / props if fields renamed.

**Acceptance:** list/rename/share/delete/dashboard-usage work against D1.
**Commit:** `feat(db): move file actions to D1 with Drizzle`

---

## Task 4 — Storage: R2 upload + authed serving route

**Goal:** replace Appwrite Storage.

**Add / change:**
- `uploadFile` (in `file.actions.ts`) → `env.BUCKET.put(r2Key, bytes)` +
  delete-on-rollback if the DB insert fails.
- `deleteFile` → `env.BUCKET.delete(r2Key)`.
- `app/api/files/[...key]/route.ts` — GET: resolve file row, enforce owner-or-share
  ACL via session, stream `env.BUCKET.get(key)`; `?download=1` →
  `Content-Disposition: attachment`.
- `lib/utils.ts` — `constructFileUrl(key)` → `/api/files/${key}`;
  `constructDownloadUrl(key)` → `/api/files/${key}?download=1`.
- `next.config.ts` — `images.remotePatterns` → app origin (drop appwrite hosts).

**Acceptance:** upload → file visible/streamed; download works; non-owner blocked.
**Commit:** `feat(storage): move file storage to R2 with authed streaming route`

---

## Task 5 — Remove Appwrite

**Goal:** delete all Appwrite code/deps/env.

**Add / change:**
- Delete `lib/appwrite/` (`config.ts`, `index.ts`).
- Remove `node-appwrite` from `package.json`.
- Remove any residual `NEXT_PUBLIC_APPWRITE_*` / `NEXT_APPWRITE_SECRET_KEY` refs.
- Grep for `appwrite` — must be zero hits in `app/`, `lib/`, `components/`.

**Acceptance:** `grep -ri appwrite app lib components` empty; `pnpm build` green.
**Commit:** `chore: remove Appwrite dependency and config`

---

## Task 6 — CI/CD: GitHub Actions → Workers on `prod`

**Goal:** auto-deploy when `prod` receives a push.

**Add / change:**
- `.github/workflows/deploy.yml`:
  - `on: push: branches: [prod]`
  - steps: checkout → setup pnpm/node → `pnpm install` →
    `wrangler d1 migrations apply DB --remote` →
    `cloudflare/wrangler-action` with `command: deploy` (runs OpenNext build+deploy)
  - env from repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`;
    worker secrets already set in CF (`BETTER_AUTH_SECRET`, `RESEND_API_KEY`,
    `EMAIL_FROM`, `BETTER_AUTH_URL`).

**Acceptance:** workflow validates (`act` optional); merging `dev → prod` deploys.
**Commit:** `ci: deploy to Cloudflare Workers on push to prod`

---

## Task 7 — README + docs final polish

**Goal:** README describes the pure-Cloudflare stack.

**Add / change:**
- `README.md` — tech-stack table, local dev with `wrangler`/`.dev.vars`, deploy
  section (push `dev`, merge `prod`), env-var reference pointing to
  `docs/deployment-keys.md`. Remove Appwrite setup.

**Commit:** `docs: update README for Cloudflare stack`

---

## Task 8 — Full verification pass

**Goal:** prove the migrated app runs.

- `pnpm exec opennextjs-cloudflare build` green.
- `pnpm preview` locally with `.dev.vars` + local D1/R2: full flow (sign-up → OTP
  → upload → view → download → rename → share → delete → dashboard).
- Typecheck/lint clean.

**Commit:** `test: verify end-to-end Cloudflare migration` (only if files change)
