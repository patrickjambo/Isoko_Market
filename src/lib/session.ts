import 'server-only';
import { cookies } from 'next/headers';
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

export type SessionPayload = {
  userId: string;
  role: 'BUYER' | 'SELLER' | 'EMPLOYER' | 'ADMIN';
  /** Session version — must match the user's current sessionVersion, so bumping
   *  it (e.g. on ban) instantly revokes every outstanding session. */
  v?: number;
};

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret);

  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
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
