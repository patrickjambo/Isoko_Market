import 'server-only';
import { prisma } from './prisma';
import { generateOtp, hashOtp, verifyOtp } from './crypto';
import { sendOtpEmail } from './email';
import { ApiError } from './api';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Issue a fresh OTP for an email address and deliver it by email. Any previous
 * unconsumed codes for the same purpose are invalidated so only the latest one
 * works. OTPs are hashed, never stored or logged in plaintext (Section 10).
 */
export async function issueOtp(email: string, purpose = 'login'): Promise<string> {
  const code = generateOtp();

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
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    }),
  ]);

  await sendOtpEmail(email, code);
  return code;
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
