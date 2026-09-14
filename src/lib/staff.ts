import 'server-only';
import type { AdminRole, Role, User } from '@prisma/client';
import { prisma } from './prisma';
import { env } from './env';

const parse = (list: string) =>
  new Set(
    list
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );

const ADMIN_SET = parse(env.ADMIN_EMAILS);
const MODERATOR_SET = parse(env.MODERATOR_EMAILS);

/** The staff role an email is configured for (env bootstrap), or null. */
export function staffRoleForEmail(email: string): AdminRole | null {
  const e = email.trim().toLowerCase();
  if (ADMIN_SET.has(e)) return 'SUPER_ADMIN';
  if (MODERATOR_SET.has(e)) return 'MODERATOR';
  return null;
}

/**
 * Bootstrap platform staff at login: if the user's email is in ADMIN_EMAILS /
 * MODERATOR_EMAILS and they aren't an admin yet, promote them to ADMIN with the
 * matching sub-role. Deliberately one-way — it never demotes and never overrides
 * an EXISTING admin's sub-role (that's managed in Admin → Roles), so env config
 * can't fight the UI or accidentally lock staff out. Returns the (possibly
 * updated) user so the caller mints the session with the right role.
 */
export async function ensureStaffRole<T extends Pick<User, 'id' | 'email' | 'role' | 'adminRole'>>(
  user: T
): Promise<T> {
  const target = user.email ? staffRoleForEmail(user.email) : null;
  if (!target || user.role === 'ADMIN') return user; // not staff, or already an admin
  return prisma.user.update({
    where: { id: user.id },
    data: { role: 'ADMIN' as Role, adminRole: target },
  }) as unknown as Promise<T>;
}
