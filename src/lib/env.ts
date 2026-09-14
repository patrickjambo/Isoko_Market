import { z } from 'zod';

/**
 * Central, validated environment access. Fails fast at boot if a required
 * secret is missing (Section 14). Never read process.env directly elsewhere.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 chars'),
  // Shared secret for scheduled jobs (Vercel Cron). Falls back to AUTH_SECRET.
  CRON_SECRET: z.string().optional(),
  // Shared secret a payment-provider webhook must present. Falls back to
  // AUTH_SECRET; superseded by real provider HMAC verification when MoMo lands.
  PAYMENTS_WEBHOOK_SECRET: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Email is the auth/OTP + notification channel (replaces SMS). `console` prints
  // to the server log for local dev; `resend`/`brevo` send real email once the
  // matching key is set. Brevo delivers to any recipient after a single verified
  // sender (no domain needed) — see src/lib/email.ts.
  EMAIL_PROVIDER: z.enum(['console', 'resend', 'brevo']).default('console'),
  RESEND_API_KEY: z.string().optional().default(''),
  BREVO_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('Isoko Market <onboarding@resend.dev>'),

  // AI assist (Claude) — writes listing descriptions, CV summaries, etc. from a
  // few words. Optional: with no ANTHROPIC_API_KEY the app falls back to the
  // built-in rule-based drafter, so nothing breaks. AI_MODEL defaults to Opus;
  // set it to claude-haiku-4-5 for a much cheaper/faster option on short drafts.
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  AI_MODEL: z.string().default('claude-opus-4-8'),

  // SMS is now DORMANT (phone is no longer the auth channel). Retained so the
  // adapter can be reactivated if transactional SMS is ever added.
  SMS_PROVIDER: z.enum(['console', 'pindo', 'africastalking']).default('console'),
  SMS_API_KEY: z.string().optional().default(''),
  SMS_SENDER_ID: z.string().default('ISOKO'),

  PAYMENTS_PROVIDER: z.enum(['mock', 'mtn_momo', 'airtel_money']).default('mock'),

  // `local` writes to /public/uploads (dev only — a serverless host has no
  // persistent disk). `vercel_blob` stores objects in Vercel Blob (prod). `r2`
  // (Cloudflare) and `s3` (AWS/DigitalOcean Spaces/any S3-compatible) share one
  // SDK — see the S3_* vars below.
  STORAGE_DRIVER: z.enum(['local', 'vercel_blob', 'r2', 's3']).default('local'),
  // Auto-injected by Vercel when Blob is enabled; set locally to exercise the
  // blob driver against a real store. Empty otherwise.
  BLOB_READ_WRITE_TOKEN: z.string().optional().default(''),

  // S3-compatible object storage (STORAGE_DRIVER=s3|r2). Public product images are
  // served from S3_PUBLIC_URL (a CDN/bucket domain) as stable, cacheable URLs;
  // private docs (IDs/CVs) are stored by key and read via short-lived signed URLs.
  // For Cloudflare R2: S3_REGION=auto, S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com.
  S3_ENDPOINT: z.string().optional().default(''), // blank = AWS default endpoint
  S3_REGION: z.string().optional().default('auto'),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  S3_PUBLIC_URL: z.string().optional().default(''), // e.g. https://cdn.isoko.market

  REALTIME_DRIVER: z.enum(['sse', 'pusher', 'ably']).default('sse'),
}).superRefine((val, ctx) => {
  // Fail fast if an S3/R2 driver is selected without its required config —
  // otherwise public image URLs are built from an empty S3_PUBLIC_URL and silently
  // saved as broken relative paths.
  if (val.STORAGE_DRIVER === 's3' || val.STORAGE_DRIVER === 'r2') {
    for (const key of ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_URL'] as const) {
      if (!val[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when STORAGE_DRIVER=${val.STORAGE_DRIVER}`,
        });
      }
    }
  }
});

// Values pasted into a hosting dashboard often carry stray whitespace or a
// trailing newline, and a var set to "" is really "unset" — so trim everything
// and drop empty strings to undefined, letting the schema defaults apply
// instead of failing enum/url checks on ""/"resend\n".
const normalizedEnv = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => {
    const trimmed = typeof value === 'string' ? value.trim() : value;
    return [key, trimmed === '' ? undefined : trimmed];
  })
);

const parsed = schema.safeParse(normalizedEnv);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration. See .env.example.');
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
