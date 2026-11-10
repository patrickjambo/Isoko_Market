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
 * Bootstrap platform staff at login (and self-heal on every admin API call).
 *
 * Sets role=ADMIN and adminRole from env config. This is now idempotent AND
 * corrective — if the DB has the wrong adminRole (e.g. MODERATOR when the email
 * is in ADMIN_EMAILS and should be SUPER_ADMIN), it corrects it.
 *
 * The env config is the single source of truth for who is an admin and at what
 * level. Per-admin permission overrides (via the Roles UI) layer on top.
 */
export async function ensureStaffRole<T extends Pick<User, 'id' | 'email' | 'role' | 'adminRole'>>(
  user: T
): Promise<T> {
  const target = user.email ? staffRoleForEmail(user.email) : null;
  if (!target) return user; // email not in any staff list — leave unchanged

  // Already correct — no DB write needed
  if (user.role === 'ADMIN' && user.adminRole === target) return user;

  // Promote or correct the role (idempotent upsert)
  return prisma.user.update({
    where: { id: user.id },
    data: { role: 'ADMIN' as Role, adminRole: target as AdminRole },
  }) as unknown as Promise<T>;
}
