import 'server-only';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

/**
 * Password hashing for platform staff (admins/moderators) who log in with
 * email + password instead of an OTP. Regular users never get a password —
 * `passwordHash` stays null for them and they keep the email-OTP flow.
 */
const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * A readable, strong temporary password (letters + digits, passes the policy) —
 * used when a super admin resets another staff member's password. Ambiguous
 * characters (0/O, 1/l/I) are omitted so it's easy to relay verbally.
 */
export function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(15);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10)}9a`;
}

/** Minimum policy for a staff password. Returns an error message, or null if OK. */
export function passwordPolicyError(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'Password must include at least one letter and one number.';
  }
  return null;
}
