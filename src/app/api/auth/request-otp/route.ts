import type { NextRequest } from 'next/server';
import { route, jsonOk, jsonError, ApiError } from '@/lib/api';
import { requestOtpSchema } from '@/lib/validators/auth';
import { normalizeRwandaPhone } from '@/lib/phone';
import { rateLimit } from '@/lib/rate-limit';
import { issueOtp } from '@/lib/otp-service';
import { env } from '@/lib/env';

export const POST = route(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const { phone } = requestOtpSchema.parse(body);
  const normalized = normalizeRwandaPhone(phone)!;

  // Rate-limit OTP requests per phone and per IP (Section 10).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const byPhone = rateLimit(`otp:phone:${normalized}`, 3, 10 * 60 * 1000);
  const byIp = rateLimit(`otp:ip:${ip}`, 10, 10 * 60 * 1000);
  if (!byPhone.success || !byIp.success) {
    throw new ApiError('RATE_LIMITED', 'Too many attempts. Please wait a few minutes.');
  }

  const code = await issueOtp(normalized, 'login');

  // In development we surface the fact that the code is in the console; never
  // return the code itself — EXCEPT under the E2E test flag (never production),
  // so Playwright can complete the OTP flow deterministically.
  const e2e = env.NODE_ENV !== 'production' && process.env.E2E_TESTING === '1';
  return jsonOk({ ok: true, devHint: env.NODE_ENV === 'development', ...(e2e ? { code } : {}) });
});

// Guard against accidental GET.
export function GET() {
  return jsonError('BAD_REQUEST', 'Use POST.');
}
