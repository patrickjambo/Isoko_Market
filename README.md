# Isoko Market

**Connecting Communities • Empowering Trade**

A trust-first, multilingual (Kinyarwanda / English / French) **marketplace + job board**
for Rwandan youth, built to the _Isoko Market Web Platform Development Brief_.

> Buy, sell, and find work with verified people. Phone-OTP login, mobile-money
> payments, a built-in CV builder, and real-time chat — designed to work well on
> slow connections and older phones.

Stack: **Next.js 14 (App Router) · TypeScript (strict) · PostgreSQL · Prisma ·
Tailwind CSS + shadcn/ui · Server-Sent-Events real-time**.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Start the self-contained local Postgres cluster (no sudo needed, port 5544)
./scripts/db.sh start

# 3. Apply the schema and seed demo data
npx prisma db push
npm run db:seed

# 4. Run the app
npm run dev          # → http://localhost:3000  (redirects to /rw)
```

Environment is pre-configured in `.env` for local development. See `.env.example`
for the full list of secrets a production deployment needs.

### Demo accounts

Login is by **phone OTP**. In development the OTP is **printed to the server
console** (`SMS_PROVIDER=console`) instead of being sent by SMS.

| Role     | Phone           | Notes                          |
| -------- | --------------- | ------------------------------ |
| Admin    | `0788000000`    | Access `/admin`                |
| Seller   | `0788111111`    | Aline — verified               |
| Seller   | `0788222222`    | Eric — verification pending    |
| Employer | `0788333333`    | Claudine — verified            |
| Buyer    | `0788444444`    | Jean-Paul — unverified, has CV |

Log in → watch the terminal for `📱 [SMS → …] your verification code is 123456`.

---

## Scripts

| Command             | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Dev server                                          |
| `npm run build`     | `prisma generate` + production build                |
| `npm start`         | Serve the production build                          |
| `npm run typecheck` | `tsc --noEmit` (strict)                             |
| `npm run test`      | Vitest unit tests (business logic)                  |
| `npm run db:seed`   | Reset + seed demo data                              |
| `npm run db:studio` | Prisma Studio                                       |
| `./scripts/db.sh`   | `start` / `stop` / `status` / `reset` the local DB  |

---

## Architecture

```
src/
  app/
    [locale]/            # /rw · /en · /fr  (Kinyarwanda default)
      (app)/             # main experience — top nav + mobile bottom tab bar
        page.tsx         #   home / landing
        marketplace/     #   browse · detail · create
        jobs/            #   board · detail · apply · applicants
        cv/              #   guided CV builder (+ PDF export)
        messages/        #   real-time chat
        notifications/ · profile/ · wallet/ · verify/ · admin/
      (auth)/            # phone-OTP login / register (minimal chrome)
    api/                 # REST route handlers (auth, listings, jobs, cv,
                         #   messages, payments, verification, admin, realtime…)
  components/            # ui/ (shadcn-style) · trust/ · nav/ · marketplace/
                         #   jobs/ · cv/ · messaging/ · admin/ · shared/
  lib/                   # prisma · auth/session · otp · payments/ (provider
                         #   interface + adapters) · realtime · storage ·
                         #   validators/ (zod) · rate-limit · queries
  messages/              # rw.json · en.json · fr.json  (complete, no fallbacks)
  i18n/                  # next-intl routing / request config
prisma/                  # schema.prisma · seed.ts
tests/                   # vitest: phone, money, otp, payments, validators
```

### Design decisions worth knowing

- **Auth** — a phone-OTP flow issues a signed, `httpOnly` JWT session
  (`src/lib/session.ts`). It is deliberately provider-agnostic so it can be
  swapped for Auth.js/Clerk without touching feature code. OTPs are hashed
  (never stored/logged in plaintext) and rate-limited.
- **Real-time** — the default transport is an in-process pub/sub bus consumed by
  an SSE endpoint (`/api/realtime`), so live chat, notification badges and
  application-status updates work with **zero external services**. `publish()` in
  `src/lib/realtime.ts` is the single seam to swap in Pusher/Ably for multi-instance
  production.
- **Payments** — business logic never calls MTN/Airtel directly. It goes through
  the `PaymentProvider` interface (`src/lib/payments/`), with `mock`, `mtn_momo`
  scaffolds and carrier auto-routing. Money is stored in **RWF minor units**
  (integers) to avoid float drift.
- **Storage** — a driver abstraction (`local` for dev, `r2`/`s3` for prod).
  Private files (ID documents, CVs) are separated and, in production, served only
  via short-lived signed URLs.
- **i18n** — Kinyarwanda is the **default** locale, not a fallback. All three
  catalogs are complete. `useTranslations` works in both Server and Client
  Components.
- **Low bandwidth** — Server Components by default, a system-font stack (no web-font
  download), client-side image compression to WebP before upload, `next/image`,
  skeletons, native `<select>` over JS-heavy widgets, and an 87 kB shared JS
  baseline.

---

## How this maps to the brief

| Brief section                         | Where it lives                                                             |
| ------------------------------------- | ------------------------------------------------------------------------- |
| 3 · Trust first                       | `VerifiedBadge` / `StarRating` / `ActiveIndicator` on every card & profile |
| 5 · Codebase structure                | Feature-based `app/` + `components/` + `lib/` (see above)                   |
| 6.1 · Identity, trust & verification  | Phone OTP, ID upload → `/verify`, admin approval, reporting                 |
| 6.2 · Marketplace                     | `marketplace/` + `/api/listings` (search, filters, verified-only, sold)    |
| 6.3 · Jobs & CV builder               | `jobs/` + `cv/` + `/api/cv/pdf` (pdf-lib) + application lifecycle           |
| 6.4 · Payments & wallet               | `lib/payments/` provider interface + `/wallet` + `/api/payments`           |
| 6.5 · Messaging & notifications       | SSE real-time chat, read receipts, live notification center                |
| 6.6 · Multilingual                    | `messages/{rw,en,fr}.json`, locale switcher, locale-prefixed routing       |
| 6.7 · Admin & analytics               | `/admin` — KPI vs business-plan goals, moderation queue, verification queue |
| 7 · Database schema                   | `prisma/schema.prisma` (enums + indexes for trust-sensitive data)          |
| 8 · UI/UX & navigation                | Top nav + mobile bottom bar, unified “+ Post”, WCAG-minded components       |
| 9 · Real-time & performance           | SSE (<1s delivery) + Server Components, code-split, compressed images       |
| 10 · Security, privacy & compliance   | zod validation, RBAC in every route, hashed OTPs, rate limits, `/privacy`  |
| 11 · API design                       | REST under `/api`, uniform `{ error: { code, message } }` shape            |
| 13 · Testing                          | Vitest unit tests; `tsc` strict; Lighthouse/Playwright hooks noted below   |

---

## Testing & quality

```bash
npm run typecheck    # strict TypeScript, no implicit any
npm run test         # vitest — phone, money, OTP, payments, validators, authz, skills, onboarding, cv-format, rate-limit, serialize, utils, i18n, error localization
npm run build        # full production build
npm run test:e2e     # Playwright — real-browser journeys + accessibility
npm run perf:budget  # Rule 7 — production JS-weight budget (3G / low-bandwidth)
```

**Unit** (Vitest) cover the pure business logic (phone normalization, money math,
OTP crypto, payment adapter, validation schemas, the unified `can()` authorizer,
the skills/match engine, and onboarding/role routing).

**E2E** (Playwright, Section 13) drive the real UI in a browser:
- `auth.spec.ts` — register via phone OTP → land on the home feed
- `buyer-journey.spec.ts` — seller lists → buyer registers → **Buy Now (escrow)
  → Confirm Receipt → review** (the full buyer↔seller↔escrow↔review path)
- `employer-journey.spec.ts` — employer posts a job → two seekers apply → **hire
  → the job-filled cascade** moves the rest to "Position filled"
- `role-landing.spec.ts` — each role **lands on its own home** on login
- `a11y.spec.ts` — **axe-core WCAG 2 A/AA** scan of the key screens in **all three
  locales** (fails on any serious/critical violation)

**Accessibility (Rule 7).** `a11y.spec.ts` enforces WCAG A/AA on every public
screen in rw/en/fr. The brand accent and success colors are tuned to meet the
4.5:1 contrast minimum.

**Performance (Rule 7).** `npm run perf:budget` runs the production build and
fails if the **shared First-Load JS** exceeds 110 kB or any route exceeds 260 kB
— keeping the app usable on a throttled 3G connection.

**Continuous integration (Section 14).** [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
runs `install → prisma generate → lint → typecheck → unit tests → build + 3G
budget` on every push to `main` and every pull request. No live database is
required — the build degrades gracefully without one — so CI stays fast and
self-contained.

Notes for running E2E:
- It uses the **system Chromium** (`/usr/bin/chromium`, override with
  `CHROMIUM_PATH`) via `executablePath`, so no Playwright browser download is
  needed.
- Playwright **reuses a running dev server**. Start one with the test seam first:
  `E2E_TESTING=1 npm run dev` (that flag makes `/api/auth/request-otp` return the
  OTP to the client so the flow is deterministic — **never enabled in
  production**), then `npm run test:e2e`.

---

## Production notes

This runs fully locally with no paid services. To go live (per Sections 4 & 14):

1. Point `DATABASE_URL` at managed Postgres (Neon/Supabase/RDS); run
   `prisma migrate deploy`.
2. Set `SMS_PROVIDER` + credentials for real OTP delivery.
3. Set `PAYMENTS_PROVIDER=mtn_momo` (and Airtel) with credentials, and register
   the webhook at `/api/payments/webhook`.
4. Set `STORAGE_DRIVER=r2|s3` with bucket credentials for photos/CVs/ID docs.
5. Optionally set `REALTIME_DRIVER=pusher|ably` for multi-instance real-time.
6. Rotate `AUTH_SECRET`, set `CRON_SECRET`. Enable HSTS at the edge. Wire Sentry + analytics.
7. The daily stale-listing sweep is pre-wired in `vercel.json`
   (`/api/cron/sweep`, 03:00 UTC). On Vercel, set `CRON_SECRET` and it's sent
   automatically; elsewhere, POST to the endpoint with
   `Authorization: Bearer $CRON_SECRET` from your scheduler.

_Derived from the Isoko Market business proposal (Joseph Rudakubana, African
Leadership University)._
# Isoko_Market
