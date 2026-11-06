import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { fetchGoogleUser, isGoogleOAuthEnabled } from '@/lib/google-oauth';
import { prisma } from '@/lib/prisma';
import { writeSessionCookie } from '@/lib/session';
import { uniqueReferralCode, applyReferral } from '@/lib/referral';
import { ensureStaffRole } from '@/lib/staff';
import { emitAdmin } from '@/lib/admin-realtime';
import { landingFor } from '@/lib/onboarding';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/google/callback — handles Google's redirect after consent.
 *
 * 1. Validates the CSRF state cookie matches the `state` query param.
 * 2. Exchanges the authorization code for the user's Google profile.
 * 3. Upserts a Zenova account (new users are created; returning users are
 *    recognised by their Google `sub` ID or email).
 * 4. Writes the same session cookie the OTP flow writes.
 * 5. Redirects to the app (returnTo or role-aware landing).
 */
export async function GET(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || req.nextUrl?.protocol?.replace(':', '') || 'https';
  const detectedOrigin = host ? `${proto}://${host}` : req.nextUrl?.origin;
  const initialAppUrl = detectedOrigin || env.NEXT_PUBLIC_APP_URL;

  if (!isGoogleOAuthEnabled()) {
    return NextResponse.redirect(new URL('/login?error=google_disabled', initialAppUrl).toString());
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  // Decode returnTo and origin from the state payload
  let returnTo = '/';
  let stateOrigin: string | undefined;
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
        nonce: string;
        returnTo?: string;
        origin?: string;
      };
      returnTo = decoded.returnTo || '/';
      stateOrigin = decoded.origin;
    } catch {
      // fall through
    }
  }

  const appUrl = stateOrigin || initialAppUrl;

  // User denied access on the consent screen
  if (errorParam === 'access_denied' || !code) {
    return NextResponse.redirect(new URL('/login?error=google_denied', appUrl).toString());
  }

  // CSRF check — state must match the cookie we set in the initiate route
  const storedState = req.cookies.get('google_oauth_state')?.value;
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL('/login?error=google_state', appUrl).toString());
  }

  // Exchange code for user profile
  let googleUser;
  try {
    googleUser = await fetchGoogleUser(code, appUrl);
  } catch {
    return NextResponse.redirect(new URL('/login?error=google_failed', appUrl).toString());
  }

  // Reject unverified Google email addresses (very rare, but guard anyway)
  if (!googleUser.verified_email) {
    return NextResponse.redirect(new URL('/login?error=google_unverified', appUrl).toString());
  }

  // ── Upsert the Zenova user ──────────────────────────────────────────────
  // 1. Try to find an existing user by their Google sub (most stable identifier)
  // 2. Fall back to email match (handles users who previously signed up with OTP)
  // 3. Create a new account if no match found
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { googleId: googleUser.id },
        { email: googleUser.email },
      ],
    },
  });

  const isNew = !user;

  if (!user) {
    // Brand-new user — create an account using their Google profile
    user = await prisma.user.create({
      data: {
        email: googleUser.email,
        fullName: googleUser.name || googleUser.email.split('@')[0] || 'Zenova user',
        avatarUrl: googleUser.picture ?? null,
        googleId: googleUser.id,
        role: 'BUYER',
        locale: 'en', // sensible default; user can change in settings
        referralCode: await uniqueReferralCode(),
        lastActiveAt: new Date(),
        // Email is proven by Google — mark as verified so they can trade immediately
        isVerified: true,
        verificationStatus: 'VERIFIED',
      },
    });

    // Apply a referral code from the returnTo query if one was passed
    const refCode = new URL(req.url).searchParams.get('ref');
    if (refCode) {
      await applyReferral(user.id, refCode).catch(() => {});
    }

    await emitAdmin('signup', `${user.fullName} joined via Google`);
  } else if (!user.googleId) {
    // Existing OTP user is now linking their Google account — store the sub
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: googleUser.id,
        // Update avatar only when the user hasn't set a custom one
        avatarUrl: user.avatarUrl ?? googleUser.picture ?? null,
        lastActiveAt: new Date(),
      },
    });
  } else {
    // Returning Google user — keep their profile fresh
    user = await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });
  }

  // Enforce account status (suspended users are blocked at this point too)
  if (user.accountStatus !== 'ACTIVE') {
    return NextResponse.redirect(new URL('/login?error=account_suspended', appUrl).toString());
  }

  // Bootstrap staff role (same as OTP flow)
  user = await ensureStaffRole(user);

  // Determine the destination BEFORE we build the response (we need to redirect)
  const dest = returnTo !== '/'
    ? returnTo
    : isNew
      ? '/'   // new Google users start on the personalized home
      : landingFor(user);

  // Write session cookie directly on the redirect response.
  // NOTE: we MUST use writeSessionCookie here (not createSession), because
  // createSession mutates the *ambient* cookie store which is NOT carried on
  // a NextResponse you construct and return — the cookie would silently vanish.
  const redirectTarget = dest.startsWith('http://') || dest.startsWith('https://')
    ? dest
    : `${appUrl}${dest.startsWith('/') ? '' : '/'}${dest}`;
  const redirectRes = NextResponse.redirect(redirectTarget);

  await writeSessionCookie(redirectRes, {
    userId: user.id,
    role: user.role,
    v: user.sessionVersion,
  });

  // Clear the CSRF cookie
  redirectRes.cookies.delete('google_oauth_state');

  return redirectRes;
}
