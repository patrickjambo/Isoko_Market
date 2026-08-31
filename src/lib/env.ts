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
  // to the server log for local dev; `resend` sends real email once a key is set.
  EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('Isoko Market <onboarding@resend.dev>'),

  // SMS is now DORMANT (phone is no longer the auth channel). Retained so the
  // adapter can be reactivated if transactional SMS is ever added.
  SMS_PROVIDER: z.enum(['console', 'pindo', 'africastalking']).default('console'),
  SMS_API_KEY: z.string().optional().default(''),
  SMS_SENDER_ID: z.string().default('ISOKO'),

  PAYMENTS_PROVIDER: z.enum(['mock', 'mtn_momo', 'airtel_money']).default('mock'),

  // `local` writes to /public/uploads (dev only — a serverless host has no
  // persistent disk). `vercel_blob` stores objects in Vercel Blob (prod). r2/s3
  // are reserved for a future S3-compatible driver.
  STORAGE_DRIVER: z.enum(['local', 'vercel_blob', 'r2', 's3']).default('local'),
  // Auto-injected by Vercel when Blob is enabled; set locally to exercise the
  // blob driver against a real store. Empty otherwise.
  BLOB_READ_WRITE_TOKEN: z.string().optional().default(''),

  REALTIME_DRIVER: z.enum(['sse', 'pusher', 'ably']).default('sse'),
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
