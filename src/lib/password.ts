import 'server-only';
import bcrypt from 'bcryptjs';

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

/** Minimum policy for a staff password. Returns an error message, or null if OK. */
export function passwordPolicyError(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return 'Password must include at least one letter and one number.';
  }
  return null;
}
