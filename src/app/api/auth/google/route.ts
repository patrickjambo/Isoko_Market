import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { generateState, buildAuthUrl, isGoogleOAuthEnabled } from '@/lib/google-oauth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/google — initiates the Google OAuth authorization code flow.
 *
 * Accepts an optional `returnTo` query param so the user lands back where they
 * came from after a successful sign-in.
 *
 * Sets a short-lived, httpOnly `google_oauth_state` cookie to validate the
 * round-trip on the callback and prevent CSRF.
 */
export async function GET(req: NextRequest) {
  const appUrl = req.nextUrl?.origin || env.NEXT_PUBLIC_APP_URL;

  if (!isGoogleOAuthEnabled()) {
    return NextResponse.redirect(new URL('/login?error=google_disabled', appUrl));
  }

  const { searchParams } = new URL(req.url);
  const returnTo = searchParams.get('returnTo') ?? '/';

  const state = generateState();

  // Pack returnTo into state so the callback can restore it without an extra
  // cookie — keeps the flow stateless and simpler.
  const statePayload = JSON.stringify({ nonce: state, returnTo });
  const encodedState = Buffer.from(statePayload).toString('base64url');

  const url = buildAuthUrl(encodedState);
  const redirectTarget = new URL(url, req.url).toString();

  const res = NextResponse.redirect(redirectTarget);

  // CSRF protection: the callback validates this cookie against the state param.
  res.cookies.set('google_oauth_state', encodedState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 minutes — more than enough for the OAuth round-trip
  });

  return res;
}
