# Deployment Prep — everything to prepare before a successful `prod` deploy

Checklist of accounts, Cloudflare resources, secrets, and GitHub settings you must
prepare **before** merging `dev → prod` (which triggers CI/CD).

> Never commit real secret values. `.env.local` / `.dev.vars` are gitignored.

## 1. Accounts to create

| Account | Why | Free? |
| ------- | --- | ----- |
| **Cloudflare** | Workers, D1, R2, KV hosting | Yes (free plan) |
| **Resend** | Send OTP emails | Yes (~3k/mo) |
| **Domain** (optional but needed for real email) | Verified sender for OTP + custom Worker domain | Cheapest via **Cloudflare Registrar** (at-cost) |

## 2. Cloudflare resources to provision (via `wrangler`)

Run these once, then paste the returned IDs into `wrangler.jsonc`:

```bash
# D1 database  → copy database_id
wrangler d1 create storage-app-db

# R2 bucket    → name is the binding target
wrangler r2 bucket create storage-app-files

# KV namespace for OpenNext incremental cache → copy id
wrangler kv namespace create NEXT_INC_CACHE_KV
```

`wrangler.jsonc` bindings expected by the app:

| Binding | Type | Resource |
| ------- | ---- | -------- |
| `DB` | D1 | `storage-app-db` |
| `BUCKET` | R2 | `storage-app-files` |
| `NEXT_INC_CACHE_KV` | KV | OpenNext cache namespace |

Also required in `wrangler.jsonc`:
- `compatibility_date` ≥ `2024-09-23`
- `compatibility_flags: ["nodejs_compat"]`

## 3. Worker secrets (runtime)

Set on the deployed Worker (`wrangler secret put NAME`, or CF dashboard →
Worker → Settings → Variables and Secrets). **Not** `NEXT_PUBLIC_`.

| Secret | What | How to get |
| ------ | ---- | ---------- |
| `BETTER_AUTH_SECRET` | Signs sessions | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public app URL (trusted origin) | e.g. `https://storage-app.<you>.workers.dev` or custom domain |
| `RESEND_API_KEY` | Send OTP email | Resend dashboard → API Keys |
| `EMAIL_FROM` | OTP sender address | Dev: `onboarding@resend.dev` · Prod: `no-reply@yourdomain` (verified in Resend) |

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL
wrangler secret put RESEND_API_KEY
wrangler secret put EMAIL_FROM
```

## 4. GitHub repository secrets (for CI/CD)

Repo → Settings → Secrets and variables → Actions:

| Secret | What | How to get |
| ------ | ---- | ---------- |
| `CLOUDFLARE_API_TOKEN` | Lets Actions deploy | CF dashboard → My Profile → API Tokens → template "Edit Cloudflare Workers", plus **D1 Edit**, **R2 Edit**, **Workers KV Edit** permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Target account | CF dashboard → Workers overview (right sidebar) |

The workflow (`.github/workflows/deploy.yml`) fires on push to `prod`. Worker
runtime secrets (section 3) live on Cloudflare, not in GitHub.

## 5. Database migrations

Before first prod traffic, apply Drizzle migrations to the remote D1:

```bash
wrangler d1 migrations apply storage-app-db --remote
```

The CI workflow (Task 6) runs this automatically on deploy.

## 6. Email / domain notes

- **No domain (dev only):** `EMAIL_FROM=onboarding@resend.dev`. Resend delivers
  **only to the email you signed up with** — fine for testing, not real users.
- **Production (real users):** register a domain (Cloudflare Registrar is cheapest),
  add it in Resend → Domains, publish the SPF/DKIM DNS records Resend gives you
  (auto if the domain is on Cloudflare), then set `EMAIL_FROM=no-reply@yourdomain`.

## 7. Local development

Create `.dev.vars` (gitignored) mirroring the section-3 secrets, and use local
D1/R2/KV via `wrangler` / `pnpm preview`. See `.dev.vars.example` (added in Task 0).

---

### Quick pre-deploy checklist

- [ ] Cloudflare account + `CLOUDFLARE_ACCOUNT_ID`
- [ ] `CLOUDFLARE_API_TOKEN` (Workers + D1 + R2 + KV edit) → GitHub secret
- [ ] D1 `storage-app-db` created, `database_id` in `wrangler.jsonc`
- [ ] R2 `storage-app-files` created
- [ ] KV `NEXT_INC_CACHE_KV` created, `id` in `wrangler.jsonc`
- [ ] Worker secrets set: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, `EMAIL_FROM`
- [ ] Resend account + API key (+ verified domain for prod)
- [ ] D1 migrations applied `--remote`
- [ ] Merge `dev → prod` → CI/CD deploys
