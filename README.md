# Storage App

A file storage and management app — upload, browse, sort, search, share, and manage your files by type, with a dashboard summarizing storage usage. Passwordless authentication via email OTP.

> 🚧 **Migrating Appwrite → Cloudflare** (auth, database, storage, hosting all move to Cloudflare so the backend never pauses). Plan and step-by-step tasks live in [`docs/`](docs/):
> [migration-plan.md](docs/migration-plan.md) · [tasks.md](docs/tasks.md) · [deployment-keys.md](docs/deployment-keys.md).
> The sections below describe the **current (Appwrite)** setup until the migration lands.

## Features

- 🔐 Passwordless auth (email OTP) with session cookies
- 📤 Drag-and-drop file upload
- 🗂️ Files grouped by type: Documents, Images, Media, Others
- 🔍 Global search across files
- ↕️ Sort by date, name, or size
- ✏️ Rename, view details, share (by email), download, delete
- 📊 Dashboard with storage usage charts

## Tech Stack

| Layer       | Technology                                                |
| ----------- | --------------------------------------------------------- |
| Framework   | [Next.js 16](https://nextjs.org) (App Router) + React 19  |
| Language    | TypeScript                                                |
| Backend     | Next.js Server Actions                                    |
| Database    | [Appwrite](https://appwrite.io) (Databases + Storage)     |
| Auth        | Appwrite email OTP                                         |
| Styling     | Tailwind CSS v4                                            |
| UI          | shadcn/ui (Radix), lucide-react, sonner, recharts         |
| Forms       | react-hook-form + zod                                     |
| Package mgr | pnpm                                                      |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- An [Appwrite](https://appwrite.io) project with a database (user + file collections) and a storage bucket

### Setup

```bash
pnpm install
```

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://<region>.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=
NEXT_PUBLIC_APPWRITE_PROJECT_NAME=
NEXT_PUBLIC_APPWRITE_DATABASE=
NEXT_PUBLIC_APPWRITE_USER_COLLECTION=
NEXT_PUBLIC_APPWRITE_FILE_COLLECTION=
NEXT_PUBLIC_APPWRITE_FILE_STORAGE_COLLECTION=
NEXT_PUBLIC_APPWRITE_BUCKET=

# Server-only — never expose to the client
NEXT_APPWRITE_SECRET_KEY=
```

Run the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
pnpm dev      # Start dev server
pnpm build    # Production build
pnpm start    # Serve production build
pnpm lint     # Run ESLint
```

## Project Structure

```
app/
  (auth)/        Sign-in / sign-up (OTP)
  (root)/        Dashboard + [type] category routes
components/       Feature components
  ui/            shadcn/ui primitives
lib/
  actions/       Server actions (file, user)
  appwrite/      Appwrite client factories + config
  utils.ts
constants/        Nav items, dropdown actions, sort types
```

## Architecture Notes

- **Server Actions are the only data layer** — Appwrite is never called from client components.
- Two Appwrite clients: `createAdminClient` (privileged, secret key) and `createSessionClient` (per-user session).
- All routes under `app/(root)` require a valid session; requests without one redirect to `/sign-in`.

## Deploy

Deploy on [Vercel](https://vercel.com/new). Add the environment variables above in the project settings.
