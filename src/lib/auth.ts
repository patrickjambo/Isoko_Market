import 'server-only';
import { cache } from 'react';
import type { Role, User } from '@prisma/client';
import { prisma } from './prisma';
import { readSession } from './session';
import { ApiError } from './api';

/**
 * Current-user resolution + role guards. Authorization is enforced here and in
 * every API route (Section 10 — never only in the UI).
 */

// Cached per-request so multiple Server Components share one DB read.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await readSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;
  // Enforce account lifecycle + session revocation (Section: cross-module cascade).
  if (user.accountStatus !== 'ACTIVE') return null; // suspended/banned users are logged out
  if ((session.v ?? 0) !== user.sessionVersion) return null; // session revoked
  return user;
});

/** Throw 401 unless authenticated. Returns the user. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError('UNAUTHORIZED', 'Please log in to continue.');
  return user;
}

/** Throw 403 unless the user holds one of the allowed roles. */
export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new ApiError('FORBIDDEN', "You don't have permission to do that.");
  }
  return user;
}

/**
 * Trust gate: many write actions (paid features, receiving payment) require a
 * verified account. Unverified users keep reduced abilities (Section 3).
 */
export async function requireVerified(): Promise<User> {
  const user = await requireUser();
  if (!user.isVerified) {
    throw new ApiError('FORBIDDEN', 'Please verify your account to do that.');
  }
  return user;
}

/** Best-effort "active today" tracking; never blocks the request. */
export async function touchLastActive(userId: string): Promise<void> {
  prisma.user
    .update({ where: { id: userId }, data: { lastActiveAt: new Date() } })
    .catch(() => {});
}
