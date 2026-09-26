import type { NextRequest } from 'next/server';
import { route, jsonOk, jsonError, ApiError } from '@/lib/api';
import { requestOtpSchema } from '@/lib/validators/auth';
import { rateLimit } from '@/lib/rate-limit';
import { issueOtp } from '@/lib/otp-service';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

export const POST = route(async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const { email, mode, locale } = requestOtpSchema.parse(body);

  // Login authenticates EXISTING accounts only — don't create one (or waste a
  // code) for an unknown email; the client redirects these to Get Started so a
  // new user registers with a goal + name.
  if (mode === 'login') {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, role: true },
    });
    if (!existing) {
      throw new ApiError('NOT_FOUND', 'No account found for this email. Please register first.');
    }
    // Staff (ADMIN accounts with a password) log in with email + password — no
    // OTP. Tell the client to show the password field instead of sending a code.
    if (existing.passwordHash && existing.role === 'ADMIN') {
      return jsonOk({ ok: true, method: 'password' });
    }
  }

  // Rate-limit OTP requests per email and per IP (Section 10).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const byEmail = rateLimit(`otp:email:${email}`, 3, 10 * 60 * 1000);
  const byIp = rateLimit(`otp:ip:${ip}`, 10, 10 * 60 * 1000);
  if (!byEmail.success || !byIp.success) {
    throw new ApiError('RATE_LIMITED', 'Too many attempts. Please wait a few minutes.');
  }

  // Only login gets the one-tap magic link (registration needs code entry so the
  // sign-up form data is present when the code is verified).
  const code = await issueOtp(email, 'login', { locale, magicLink: mode === 'login' });

  // In development we surface the fact that the code is in the console; never
  // return the code itself — EXCEPT under the E2E test flag (never production),
  // so Playwright can complete the OTP flow deterministically.
  const e2e = env.NODE_ENV !== 'production' && process.env.E2E_TESTING === '1';
  return jsonOk({
    ok: true,
    method: 'otp',
    devHint: env.NODE_ENV === 'development',
    ...(e2e ? { code } : {}),
  });
});

// Guard against accidental GET.
export function GET() {
  return jsonError('BAD_REQUEST', 'Use POST.');
}
