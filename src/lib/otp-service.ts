import 'server-only';
import { prisma } from './prisma';
import { generateOtp, generateLinkToken, hashOtp, verifyOtp } from './crypto';
import { sendOtpEmail } from './email';
import { ApiError } from './api';
import { env } from './env';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Issue a fresh OTP for an email address and deliver it by email — both the
 * 6-digit code AND a one-tap magic link (so users can log in without copying the
 * code). Any previous unconsumed codes for the same purpose are invalidated so
 * only the latest one works. Both secrets are hashed, never stored in plaintext.
 */
export async function issueOtp(
  email: string,
  purpose = 'login',
  opts?: { locale?: string; magicLink?: boolean }
): Promise<string> {
  const code = generateOtp();
  // The magic link is a login convenience only. Registration must go through code
  // entry so the sign-up form data (name, goal) is present at verify time.
  const token = opts?.magicLink ? generateLinkToken() : null;

  await prisma.$transaction([
    prisma.otpCode.updateMany({
      where: { email, purpose, consumed: false },
      data: { consumed: true },
    }),
    prisma.otpCode.create({
      data: {
        email,
        purpose,
        codeHash: hashOtp(code),
        linkTokenHash: token ? hashOtp(token) : null,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    }),
  ]);

  let magicUrl: string | undefined;
  if (token) {
    // → the /api/auth/magic handler (an API route, so no locale prefix); locale
    // rides along so we can send the user to the right localized home after.
    const url = new URL('/api/auth/magic', env.NEXT_PUBLIC_APP_URL);
    url.searchParams.set('email', email);
    url.searchParams.set('token', token);
    if (opts?.locale) url.searchParams.set('locale', opts.locale);
    magicUrl = url.toString();
  }

  await sendOtpEmail(email, code, magicUrl);
  return code;
}

/**
 * Complete a login from the magic-link token (the email-tap path). Same lifecycle
 * as {@link consumeOtp}: single-use, expiry-checked, marked consumed on success.
 */
export async function consumeOtpByToken(email: string, token: string, purpose = 'login'): Promise<void> {
  const record = await prisma.otpCode.findFirst({
    where: { email, purpose, consumed: false, expiresAt: { gt: new Date() }, linkTokenHash: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || !record.linkTokenHash || !verifyOtp(token, record.linkTokenHash)) {
    throw new ApiError('BAD_REQUEST', 'This link is invalid or has expired.');
  }
  await prisma.otpCode.update({ where: { id: record.id }, data: { consumed: true } });
}

/**
 * Verify a submitted code. Throws ApiError on invalid/expired/too-many-attempts.
 * Marks the code consumed on success so it can't be replayed.
 */
export async function consumeOtp(email: string, code: string, purpose = 'login'): Promise<void> {
  const record = await prisma.otpCode.findFirst({
    where: { email, purpose, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) {
    throw new ApiError('BAD_REQUEST', 'That code is incorrect or has expired.');
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { consumed: true } });
    throw new ApiError('RATE_LIMITED', 'Too many attempts. Request a new code.');
  }

  if (!verifyOtp(code, record.codeHash)) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new ApiError('BAD_REQUEST', 'That code is incorrect or has expired.');
  }

  await prisma.otpCode.update({ where: { id: record.id }, data: { consumed: true } });
}
