import { NextResponse, type NextRequest } from 'next/server';
import { consumeOtpByToken } from '@/lib/otp-service';
import { prisma } from '@/lib/prisma';
import { writeSessionCookie } from '@/lib/session';
import { landingFor } from '@/lib/onboarding';
import { routing } from '@/i18n/routing';
import { env } from '@/lib/env';

function safeLocale(raw: string | null): string {
  return raw && (routing.locales as readonly string[]).includes(raw) ? raw : routing.defaultLocale;
}

/**
 * One-tap email login. The single-use token is only CONSUMED on POST — which
 * comes from pressing the button on the /{locale}/magic-link confirm page — so a
 * mail-scanner or client that merely PREFETCHES the link (a GET) can't burn the
 * token (which would also kill the paired 6-digit code). Login never creates
 * accounts; that's registration's job.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const email = String(form?.get('email') ?? '');
  const token = String(form?.get('token') ?? '');
  const locale = safeLocale(form ? String(form.get('locale') ?? '') : null);

  // 303 → the browser turns this form POST into a GET on the target.
  const to = (path: string) =>
    NextResponse.redirect(new URL(`/${locale}${path}`, env.NEXT_PUBLIC_APP_URL), 303);

  try {
    await consumeOtpByToken(email, token, 'login');
  } catch {
    return to('/login?error=link');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return to('/get-started');

  // Attach the session cookie to THIS redirect — a cookie set via next/headers
  // would be dropped on a response we build ourselves.
  const res = to(landingFor(user));
  await writeSessionCookie(res, { userId: user.id, role: user.role, v: user.sessionVersion });
  return res;
}

/**
 * Back-compat / safety: an old email link (or a link prefetch) that hits this API
 * with GET is forwarded to the confirm page — never consuming the token.
 */
export function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locale = safeLocale(searchParams.get('locale'));
  const url = new URL(`/${locale}/magic-link`, env.NEXT_PUBLIC_APP_URL);
  const email = searchParams.get('email');
  const token = searchParams.get('token');
  if (email) url.searchParams.set('email', email);
  if (token) url.searchParams.set('token', token);
  return NextResponse.redirect(url);
}
