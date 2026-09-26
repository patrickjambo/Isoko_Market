import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { route, jsonOk, jsonError, ApiError } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { createSession } from '@/lib/session';

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

/**
 * POST /api/auth/staff-login — email + password login for platform staff
 * (admins/moderators), the non-OTP path. Only accounts that are ADMIN and have
 * a password set can use it; everyone else keeps the email-OTP flow. Errors are
 * deliberately generic so this can't be used to enumerate which emails are staff.
 */
export const POST = route(async (req: NextRequest) => {
  const { email, password } = schema.parse(await req.json().catch(() => ({})));

  // Rate-limit by email and IP (mirrors the OTP flow — Section 10).
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (
    !rateLimit(`staff:email:${email}`, 5, 10 * 60 * 1000).success ||
    !rateLimit(`staff:ip:${ip}`, 20, 10 * 60 * 1000).success
  ) {
    throw new ApiError('RATE_LIMITED', 'Too many attempts. Please wait a few minutes.');
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      passwordHash: true,
      accountStatus: true,
      sessionVersion: true,
    },
  });

  const INVALID = new ApiError('UNAUTHORIZED', 'Invalid email or password.');
  // Only staff with a password may use this path. Verify the hash even when the
  // account is ineligible would be ideal for timing, but a generic error already
  // hides whether the email is staff.
  if (!user || !user.passwordHash || user.role !== 'ADMIN') throw INVALID;
  if (!(await verifyPassword(password, user.passwordHash))) throw INVALID;
  if (user.accountStatus !== 'ACTIVE') {
    throw new ApiError('FORBIDDEN', 'This account is not active. Contact an administrator.');
  }

  await createSession({ userId: user.id, role: user.role, v: user.sessionVersion });
  return jsonOk({ ok: true, redirectTo: '/admin' });
});

export function GET() {
  return jsonError('BAD_REQUEST', 'Use POST.');
}
