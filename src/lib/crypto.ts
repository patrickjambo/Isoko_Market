import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * A high-entropy, URL-safe token for one-tap magic-link login. Unlike the 6-digit
 * code it is unguessable, so it can safely travel in an email link. Hashed (via
 * {@link hashOtp}) before storage, single-use, and short-lived like the code.
 */
export function generateLinkToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * OTP hashing. OTPs are never stored or logged in plaintext (Section 10).
 * They are short-lived and salted with AUTH_SECRET before hashing.
 */
export function generateOtp(): string {
  // 6-digit numeric code, cryptographically random.
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtp(code: string): string {
  const salt = process.env.AUTH_SECRET ?? 'dev-salt';
  return createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

export function verifyOtp(code: string, hash: string): boolean {
  const candidate = Buffer.from(hashOtp(code));
  const expected = Buffer.from(hash);
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
