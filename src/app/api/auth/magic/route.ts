import { NextResponse, type NextRequest } from 'next/server';
import { consumeOtpByToken } from '@/lib/otp-service';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/session';
import { landingFor } from '@/lib/onboarding';
import { routing } from '@/i18n/routing';
import { env } from '@/lib/env';

/**
 * GET /api/auth/magic?email=&token=&locale= — the one-tap email login. Verifies
 * the single-use magic token, logs an EXISTING user straight in (login never
 * creates accounts — that's registration's job), and redirects to their home.
 * Always redirects (never returns JSON) so tapping the email link just works.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email') ?? '';
  const token = searchParams.get('token') ?? '';
  const rawLocale = searchParams.get('locale') ?? routing.defaultLocale;
  const locale = (routing.locales as readonly string[]).includes(rawLocale)
    ? rawLocale
    : routing.defaultLocale;

  const to = (path: string) => NextResponse.redirect(new URL(`/${locale}${path}`, env.NEXT_PUBLIC_APP_URL));

  try {
    await consumeOtpByToken(email, token, 'login');
  } catch {
    // Expired/invalid/already-used link — send them to log in again.
    return to('/login?error=link');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // No account for this email — magic login can't create one; go register.
  if (!user) return to('/get-started');

  await createSession({ userId: user.id, role: user.role, v: user.sessionVersion });
  return to(landingFor(user));
}
