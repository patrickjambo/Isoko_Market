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
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  SMS_PROVIDER: z.enum(['console', 'pindo', 'africastalking']).default('console'),
  SMS_API_KEY: z.string().optional().default(''),
  SMS_SENDER_ID: z.string().default('ISOKO'),

  PAYMENTS_PROVIDER: z.enum(['mock', 'mtn_momo', 'airtel_money']).default('mock'),

  STORAGE_DRIVER: z.enum(['local', 'r2', 's3']).default('local'),

  REALTIME_DRIVER: z.enum(['sse', 'pusher', 'ably']).default('sse'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration. See .env.example.');
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
