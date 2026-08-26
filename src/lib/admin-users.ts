import 'server-only';
import type { AccountStatus, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { ApiError } from './api';

/**
 * Change a user's account status with the correct cross-module cascade, all in
 * one transaction (Section: Cross-module consistency). Suspending or banning a
 * user removes their active listings, closes their open jobs and revokes every
 * session (by bumping sessionVersion) — the frontend never orchestrates this.
 */
export async function setUserStatus(params: {
  userId: string;
  status: AccountStatus;
  reason?: string;
}) {
  const target = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, role: true, accountStatus: true, fullName: true },
  });
  if (!target) throw new ApiError('NOT_FOUND', 'User not found.');
  if (target.role === 'ADMIN' && params.status !== 'ACTIVE') {
    throw new ApiError('FORBIDDEN', 'Admins cannot be suspended or banned here.');
  }

  const deactivating = params.status !== 'ACTIVE';

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.user.update({
      where: { id: params.userId },
      data: {
        accountStatus: params.status,
        statusReason: params.reason ?? null,
        // Revoke all sessions when deactivating.
        ...(deactivating ? { sessionVersion: { increment: 1 } } : {}),
      },
    }),
  ];

  if (deactivating) {
    ops.push(
      prisma.listing.updateMany({
        where: { sellerId: params.userId, status: 'ACTIVE' },
        data: { status: 'REMOVED' },
      }),
      prisma.job.updateMany({
        where: { employerId: params.userId, status: 'OPEN' },
        data: { status: 'CLOSED' },
      })
    );
  }

  await prisma.$transaction(ops);
  return { before: target.accountStatus, after: params.status };
}
