import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword, passwordPolicyError } from '@/lib/password';
import { createSession } from '@/lib/session';
import { audit } from '@/lib/audit';

const schema = z
  .object({
    currentPassword: z.string().min(1),
    email: z.string().trim().toLowerCase().email().optional(),
    newPassword: z.string().max(200).optional(),
  })
  .refine((d) => d.email || d.newPassword, {
    message: 'Provide a new email or a new password.',
  });

/**
 * PATCH /api/admin/account — a logged-in admin changes their OWN login email
 * and/or password. Re-authenticated with the current password. Changing the
 * password bumps sessionVersion (revoking other sessions), so we re-mint the
 * caller's session to keep them logged in.
 */
export const PATCH = route(async (req: NextRequest) => {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new ApiError('FORBIDDEN', 'Admins only.');

  const { currentPassword, email, newPassword } = schema.parse(await req.json().catch(() => ({})));

  if (!user.passwordHash) {
    throw new ApiError('BAD_REQUEST', 'This account has no password set. Contact a super admin.');
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ApiError('UNAUTHORIZED', 'Current password is incorrect.');
  }

  const data: { email?: string; passwordHash?: string; sessionVersion?: number } = {};

  if (email && email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (taken && taken.id !== user.id) {
      throw new ApiError('CONFLICT', 'That email is already in use.');
    }
    data.email = email;
  }

  if (newPassword) {
    const policy = passwordPolicyError(newPassword);
    if (policy) throw new ApiError('BAD_REQUEST', policy);
    data.passwordHash = await hashPassword(newPassword);
    data.sessionVersion = user.sessionVersion + 1; // revoke other sessions
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { email: true, role: true, sessionVersion: true },
  });

  // Keep the caller signed in with the (possibly bumped) session version.
  await createSession({ userId: user.id, role: updated.role, v: updated.sessionVersion });

  await audit({
    actorId: user.id,
    action: 'admin.account.update',
    targetType: 'USER',
    targetId: user.id,
    after: { emailChanged: Boolean(data.email), passwordChanged: Boolean(newPassword) },
  });

  return jsonOk({ ok: true, email: updated.email });
});
