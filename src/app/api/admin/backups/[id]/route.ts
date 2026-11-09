import { unlink } from 'node:fs/promises';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api';

/**
 * GET /api/admin/backups/[id] — View detailed backup metadata.
 */
export const GET = adminRoute('backup.view', async (_req, ctx: { params: { id: string } }) => {
  const backup = await prisma.backupRecord.findUnique({
    where: { id: ctx.params.id },
    include: {
      createdBy: { select: { id: true, fullName: true, email: true } },
      restorations: {
        orderBy: { createdAt: 'desc' },
        include: { performedBy: { select: { id: true, fullName: true } } },
      },
    },
  });

  if (!backup) {
    throw new ApiError('NOT_FOUND', 'Backup not found');
  }

  return {
    data: backup,
  };
});

/**
 * DELETE /api/admin/backups/[id] — Safely remove an expired or unneeded backup.
 */
export const DELETE = adminRoute('backup.restore', async (_req, ctx: { params: { id: string } }, { admin }) => {
  const backup = await prisma.backupRecord.findUnique({
    where: { id: ctx.params.id },
  });

  if (!backup) {
    throw new ApiError('NOT_FOUND', 'Backup not found');
  }

  if (backup.type === 'SAFETY_SNAPSHOT') {
    throw new ApiError('BAD_REQUEST', 'Pre-restoration safety snapshots cannot be manually deleted.');
  }

  // Remove file from disk
  await unlink(backup.storageLocation).catch(() => {});

  // Remove DB record
  await prisma.backupRecord.delete({ where: { id: ctx.params.id } });

  // Audit log
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'backup.delete',
      targetType: 'SYSTEM',
      targetId: ctx.params.id,
      reason: `Deleted backup ${backup.filename}`,
      before: { id: backup.id, filename: backup.filename, sizeBytes: backup.sizeBytes },
    },
  });

  return {
    data: { success: true, deletedId: ctx.params.id },
  };
});
