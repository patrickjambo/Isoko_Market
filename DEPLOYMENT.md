# Isoko Market — Production Deployment Checklist

Isoko is a **Next.js 14 (App Router)** app for **Vercel**, with **Prisma + PostgreSQL**
and S3-compatible object storage. Vercel handles load balancing, horizontal
auto-scaling, the edge CDN, and image optimization automatically — the checklist
below is the **configuration** you own. Nothing here is code; it's env vars and a
few provider settings.

> Tip: every variable is validated at boot by `src/lib/env.ts`. A missing/invalid
> required value fails the build fast with a clear message.

---

## 1. Database (managed Postgres + pooling)

Serverless functions open many short-lived connections and will exhaust a raw
Postgres connection limit under load. Use a provider with a **built-in pooler**
(Neon, Supabase, or RDS + RDS Proxy) and give Prisma **two** URLs:

| Var | Value | Used by |
| --- | --- | --- |
| `DATABASE_URL` | the **pooled** connection (PgBouncer). On Neon it contains `-pooler` and `?sslmode=require`; add `?pgbouncer=true&connection_limit=1` | app queries at runtime |
| `DIRECT_URL` | the **direct** (unpooled) connection | `prisma migrate` / DDL only |

Already wired in `prisma/schema.prisma` (`url` + `directUrl`). After setting them:

```bash
npx prisma migrate deploy   # apply migrations against DIRECT_URL
```

Enable the provider's **automated daily backups**. Add a **read replica** later
only if search load competes with writes (not needed at launch).

---

## 2. Object storage (product images + private docs)

Pick one driver and set `STORAGE_DRIVER`:

- `vercel_blob` — simplest; set nothing else (token auto-injected on Vercel).
- `r2` (Cloudflare) or `s3` (AWS / DigitalOcean Spaces) — for 1M+ images at lower cost:

| Var | Example |
| --- | --- |
| `STORAGE_DRIVER` | `r2` |
| `S3_REGION` | `auto` (R2) / `eu-west-1` (AWS) |
| `S3_ENDPOINT` | `https://<account>.r2.cloudflarestorage.com` (blank for AWS) |
| `S3_BUCKET` | `isoko-media` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | from the bucket's API token |
| `S3_PUBLIC_URL` | the bucket's public/CDN domain, e.g. `https://cdn.isoko.market` |

**Bucket CORS** — required so the browser can upload **directly** to storage
(direct-to-cloud, bypassing the 4.5 MB serverless body limit). Without it, uploads
silently fall back to the server route. Allow `PUT` from your origin:

```json
[
  {
    "AllowedOrigins": ["https://isoko-market.vercel.app", "https://<your-domain>"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3000
  }
]
```

Make the `public/` prefix publicly readable (or front it with a CDN/custom domain
= `S3_PUBLIC_URL`). `private/` (IDs/CVs) stays private — served via short-lived
signed URLs. The database only ever stores the URL string, never the binary.

---

## 3. Email (auth codes + notifications)

Email is the login (OTP + magic link) and notification channel.

| Var | Value |
| --- | --- |
| `EMAIL_PROVIDER` | `brevo` (delivers to anyone after one verified sender — no domain needed) or `resend` |
| `BREVO_API_KEY` / `RESEND_API_KEY` | provider key |
| `EMAIL_FROM` | `Isoko Market <no-reply@your-domain>` |

Leave `EMAIL_PROVIDER=console` and codes print to the server log (dev only).

---

## 4. Core secrets & app URL

| Var | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | your canonical URL, e.g. `https://isoko-market.vercel.app` — used for magic links, OG tags, `apple-touch-icon` |
| `AUTH_SECRET` | 32+ random chars (`openssl rand -base64 32`) — signs sessions & hashes OTPs |
| `CRON_SECRET` | secret Vercel Cron presents to `/api/cron/*` (falls back to `AUTH_SECRET`) |
| `PAYMENTS_WEBHOOK_SECRET` | secret the payment webhook must present |
| `ANTHROPIC_API_KEY` | optional — enables AI drafts; without it the rule-based fallback is used |
| `ADMIN_EMAILS` | comma-separated emails auto-provisioned as **SUPER_ADMIN** on login (bootstrap the first admins) |
| `MODERATOR_EMAILS` | comma-separated emails auto-provisioned as **MODERATOR** on login |

> Staff bootstrap: put your own email in `ADMIN_EMAILS`, deploy, then log in
> normally (email code or magic link) — you land in **/admin** as super-admin.
> From there, manage everyone else's sub-roles in **Admin → Roles**. Env only
> *promotes* on login; it never demotes and never overrides an existing admin's
> sub-role, so it can't fight the UI or lock staff out. To revoke, change the
> sub-role in Admin → Roles (and remove from the env list).

---

## 5. Deploy

1. Push to the branch connected to Vercel (or `vercel --prod`).
2. Set all env vars above in **Vercel → Project → Settings → Environment Variables** (Production).
3. First deploy: run `npx prisma migrate deploy` (Vercel build hook or once via CLI against `DIRECT_URL`).
4. Verify the **Cron jobs** in `vercel.json` (`/api/cron/sweep` daily, `/api/cron/wallet-reconcile` weekly) appear under Vercel → Cron.

---

## 6. Post-deploy verification

- **Health probe:** `curl https://<domain>/api/health` → `200 {"status":"ok","db":"up"}`.
  Point an uptime monitor (Better Uptime, Vercel Monitoring, Grafana Cloud) at it
  for the 99.9% target and alerting.
- **Upload:** post a listing with a photo → confirm it lands in the bucket and
  renders (WebP/AVIF via `next/image`).
- **Login:** request a code → confirm the email arrives with both the code and the
  one-tap magic link.

---

## What Vercel handles automatically (no action)

| Concern | Handled by |
| --- | --- |
| Load balancing | Vercel Edge Network |
| Horizontal auto-scaling / concurrency | Serverless Functions (scale per request) |
| Image optimization (AVIF/WebP, resize) | `next/image` + Vercel Image Optimization |
| Static/edge caching | Vercel CDN |
| Post-response background work (transaction emails) | `waitUntil` via `src/lib/background.ts` |
| Scheduled jobs | Vercel Cron (`vercel.json`) |
