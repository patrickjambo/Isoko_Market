import 'server-only';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';

/**
 * Stateless, signed session using a secure httpOnly cookie (Section 10).
 * This is intentionally provider-agnostic: the OTP flow issues the session
 * here, so swapping to Auth.js/Clerk later only touches this module.
 */
const COOKIE = 'isoko_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const secret = new TextEncoder().encode(env.AUTH_SECRET);

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: MAX_AGE,
} as const;

export type SessionPayload = {
  userId: string;
  role: 'BUYER' | 'SELLER' | 'EMPLOYER' | 'ADMIN';
  /** Session version — must match the user's current sessionVersion, so bumping
   *  it (e.g. on ban) instantly revokes every outstanding session. */
  v?: number;
};

async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);
}

/** Issue a session via the ambient cookie store — for handlers that return a
 *  plain JSON response (the cookie is attached to the implicit response). */
export async function createSession(payload: SessionPayload): Promise<void> {
  cookies().set(COOKIE, await signSession(payload), COOKIE_OPTIONS);
}

/**
 * Issue a session by attaching the cookie DIRECTLY to a response you return
 * yourself — required for redirect handlers (e.g. the magic-link login). Cookie
 * mutations made via next/headers `cookies()` are NOT carried on a NextResponse
 * you construct and return, so using `createSession()` there silently drops the
 * cookie and the user ends up redirected-but-not-logged-in.
 */
export async function writeSessionCookie(
  res: NextResponse,
  payload: SessionPayload
): Promise<void> {
  res.cookies.set(COOKIE, await signSession(payload), COOKIE_OPTIONS);
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.userId as string,
      role: payload.role as SessionPayload['role'],
      v: (payload.v as number | undefined) ?? 0,
    };
  } catch {
    return null;
  }
}

export function destroySession(): void {
  cookies().delete(COOKIE);
}
