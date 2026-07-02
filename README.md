# Storage App

A file storage and management app — upload, browse, sort, search, share, and manage your files by type, with a dashboard summarizing storage usage. Passwordless authentication via email OTP. Runs entirely on Cloudflare.

## Features

- 🔐 Passwordless auth (email OTP) with session cookies
- 📤 Drag-and-drop file upload
- 🗂️ Files grouped by type: Documents, Images, Media, Others
- 🔍 Global search across files
- ↕️ Sort by date, name, or size
- ✏️ Rename, view details, share (by email), download, delete
- 📊 Dashboard with storage usage charts

## Tech Stack

| Layer       | Technology                                                          |
| ----------- | ------------------------------------------------------------------- |
| Framework   | [Next.js 16](https://nextjs.org) (App Router) + React 19            |
| Language    | TypeScript                                                          |
| Hosting     | Cloudflare Workers via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) |
| Backend     | Next.js Server Actions                                              |
| Auth        | [better-auth](https://better-auth.com) (email OTP)                  |
| Email       | [Resend](https://resend.com) (transactional OTP delivery)          |
| Database    | Cloudflare D1 (SQLite) + [Drizzle ORM](https://orm.drizzle.team)   |
| Storage     | Cloudflare R2 (private bucket, authed streaming route)              |
| Cache       | Cloudflare Workers KV (OpenNext incremental cache)                  |
| Styling     | Tailwind CSS v4                                                     |
| UI          | shadcn/ui (Radix), lucide-react, sonner, recharts                  |
| Forms       | react-hook-form + zod                                              |
| Package mgr | pnpm                                                               |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- A [Cloudflare](https://cloudflare.com) account
- [wrangler](https://developers.cloudflare.com/workers/wrangler/) (installed as a dev dependency; run via `pnpm exec wrangler`)

### Install

```bash
pnpm install
```

### Runtime secrets

Copy the example file and fill in real values:

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` is gitignored and holds the local runtime secrets the Worker reads
per request:

| Variable             | What                                                             |
| -------------------- | --------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` | Random 32+ char secret used to sign sessions (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL`    | App base URL — `http://localhost:3000` in dev                   |
| `RESEND_API_KEY`     | Resend API key for OTP email delivery                           |
| `EMAIL_FROM`         | Verified sender address — `onboarding@resend.dev` in dev        |

> In dev, `onboarding@resend.dev` delivers **only** to the email you signed up
> with at Resend. For real recipients you need a verified sender domain — see
> [`docs/deployment-keys.md`](docs/deployment-keys.md).

### Local resources & database

The app binds to local D1, R2 and KV resources. Generate and apply the Drizzle
migrations to the local D1 database before first run:

```bash
pnpm exec drizzle-kit generate                                # emit SQL into drizzle/ (only after schema changes)
pnpm exec wrangler d1 migrations apply storage-app-db --local # apply to the local D1
```

The binding names (`DB`, `BUCKET`, `NEXT_INC_CACHE_KV`) are declared in
[`wrangler.jsonc`](wrangler.jsonc); the local R2 and KV stores are created on
demand by wrangler.

### Run

```bash
pnpm dev        # Next.js dev server (OpenNext dev bindings), http://localhost:3000
pnpm preview    # build with OpenNext + run a Worker preview against local D1/R2/KV
```

Use `pnpm dev` for fast iteration and `pnpm preview` to exercise the real Worker
runtime and bindings before deploying.

## Scripts

| Script            | What it does                                                        |
| ----------------- | ------------------------------------------------------------------- |
| `pnpm dev`        | Start the Next.js dev server                                        |
| `pnpm build`      | `next build` (framework build only)                                 |
| `pnpm start`      | Serve the Next.js production build                                   |
| `pnpm lint`       | Run ESLint                                                           |
| `pnpm preview`    | OpenNext build + local Worker preview (`opennextjs-cloudflare build && … preview`) |
| `pnpm deploy`     | OpenNext build + deploy to Cloudflare Workers (`… build && … deploy`) |
| `pnpm cf-typegen` | Regenerate Cloudflare binding types (`CloudflareEnv`) from `wrangler.jsonc` |

## Project Structure

```
app/
  (auth)/                 Sign-in / sign-up (OTP)
  (root)/                 Dashboard + [type] category routes
  api/
    auth/[...all]/        better-auth catch-all handler
    files/[...key]/       Authed R2 streaming route (view/download)
components/               Feature components
  ui/                     shadcn/ui primitives
lib/
  actions/                Server actions (file, user) — the data layer
  db/                     Drizzle schema + D1 client
  auth.ts                 better-auth instance (email OTP + Resend)
  auth-client.ts          better-auth browser client
  storage.ts              R2 helpers (put / get / delete)
  mappers.ts              Map DB rows to the shapes components consume
  utils.ts
constants/                Nav items, dropdown actions, sort types
drizzle/                  Generated D1 migrations
wrangler.jsonc            Worker config + bindings (DB, BUCKET, NEXT_INC_CACHE_KV)
open-next.config.ts       OpenNext Cloudflare config (KV incremental cache)
```

## Architecture Notes

- **Server Actions are the data layer** — `lib/actions/` is the only place that
  touches D1 and R2; client components never call Cloudflare services directly.
- **Auth** is [better-auth](https://better-auth.com) with the email-OTP plugin,
  sending codes through Resend. Sessions are cookie-based, backed by the D1
  `session` table. All routes under `app/(root)` require a valid session.
- **Database** is Cloudflare D1 (SQLite) accessed through Drizzle ORM. better-auth
  owns the `user` / `session` / `account` / `verification` tables; the app adds
  `files` and `file_shares`.
- **Storage** is a **private** R2 bucket. Objects are never public — they are
  served only through the authed `/api/files/[...key]` route, which resolves the
  file row, enforces an owner-or-shared-by-email ACL, then streams the R2 object
  with the correct `Content-Type` / `Content-Disposition`.
- **Bindings** (`DB`, `BUCKET`, `NEXT_INC_CACHE_KV`) and runtime secrets are only
  available per request on Workers, so they are resolved lazily via OpenNext's
  `getCloudflareContext()` — never at module top level.

## Deploy / CI-CD

The GitHub Actions workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))
deploys to Cloudflare Workers **on push to `prod`**. It applies remote D1
migrations and then runs `pnpm run deploy` (OpenNext build + deploy).

Default flow:

1. Commit and push your work to `dev`.
2. Merge `dev → prod` to cut a release — the push to `prod` triggers the deploy.

Before the first prod deploy you must provision the Cloudflare resources, Worker
runtime secrets, and GitHub Actions secrets. See
[`docs/deployment-keys.md`](docs/deployment-keys.md) for the full checklist, and
[`docs/migration-plan.md`](docs/migration-plan.md) for architecture background.
