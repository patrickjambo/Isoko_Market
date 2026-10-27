import 'server-only';
import { randomBytes } from 'node:crypto';
import { env } from './env';

/**
 * Google OAuth 2.0 helper (Section 10 — provider-agnostic auth).
 *
 * We implement the standard authorization-code flow manually rather than
 * pulling in NextAuth, so the session cookie format stays identical to the
 * OTP path and no other part of the codebase needs to know about OAuth.
 *
 * Flow:
 *   1. /api/auth/google          → redirect to Google consent screen
 *   2. Google redirects back to  → /api/auth/google/callback?code=…&state=…
 *   3. Callback exchanges code for tokens, fetches profile, upserts user,
 *      writes a session cookie, and redirects to the app.
 */

export const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export const SCOPES = ['openid', 'email', 'profile'].join(' ');

/** True when real Google OAuth keys are set in the environment. */
export function isRealGoogleConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/** True when simulation / dev fallback is permitted (local dev, test, or ENABLE_DEV_AUTH=true). */
export function isDevFallbackAllowed(): boolean {
  return env.NODE_ENV !== 'production' || process.env.ENABLE_DEV_AUTH === 'true';
}

/** True when Google OAuth is usable (production configured or development/test fallback). */
export function isGoogleOAuthEnabled(): boolean {
  return isRealGoogleConfigured() || isDevFallbackAllowed();
}

/** Opaque CSRF state token — stored in a short-lived cookie. */
export function generateState(): string {
  return randomBytes(24).toString('hex');
}

/** Build the redirect URI for the current deployment. */
export function callbackUrl(): string {
  return `${env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;
}

/** Build the Google authorization URL to send the user to. */
export function buildAuthUrl(state: string, returnTo?: string): string {
  if (!isRealGoogleConfigured() && isDevFallbackAllowed()) {
    // In local dev/staging without credentials, route directly to callback with dev mock
    const params = new URLSearchParams({
      code: 'dev_google_mock',
      state,
      ...(returnTo ? { returnTo } : {}),
    });
    return `${callbackUrl()}?${params}`;
  }

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(),
    response_type: 'code',
    scope: SCOPES,
    state,
    access_type: 'online',
    prompt: 'select_account', // always show the account picker
    ...(returnTo ? { login_hint: returnTo } : {}),
  });
  return `${GOOGLE_AUTH_BASE}?${params}`;
}

export type GoogleUserInfo = {
  id: string;          // Google sub
  email: string;
  name: string;
  picture: string | null;
  verified_email: boolean;
};

/** Exchange the authorization code for tokens and return the user profile. */
export async function fetchGoogleUser(code: string): Promise<GoogleUserInfo> {
  if (code === 'dev_google_mock' && isDevFallbackAllowed() && !isRealGoogleConfigured()) {
    return {
      id: 'google_dev_mock_id_9901',
      email: 'user.google@gmail.com',
      name: 'Google User',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=face',
      verified_email: true,
    };
  }

  // 1. Token exchange
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(),
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text().catch(() => 'unknown');
    throw new Error(`Google token exchange failed: ${err}`);
  }

  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) {
    throw new Error('Google did not return an access token');
  }

  // 2. User profile
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: 'no-store',
  });

  if (!userRes.ok) {
    const err = await userRes.text().catch(() => 'unknown');
    throw new Error(`Google userinfo fetch failed: ${err}`);
  }

  return userRes.json() as Promise<GoogleUserInfo>;
}
