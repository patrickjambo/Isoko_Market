import { adminRoute } from '@/lib/admin-route';
import { verifyBackupIntegrity } from '@/lib/backup/engine';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/admin/backups/[id]/verify — Verify backup integrity.
 */
export const POST = adminRoute('backup.view', async (_req, ctx: { params: { id: string } }, { admin }) => {
  const result = await verifyBackupIntegrity(ctx.params.id);

  // Log verification audit
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'backup.verify',
      targetType: 'SYSTEM',
      targetId: ctx.params.id,
      reason: `Integrity check ${result.valid ? 'PASSED' : 'FAILED'} (checksum: ${result.checksumSha256 || 'n/a'})`,
      after: JSON.parse(JSON.stringify(result)),
    },
  });

  return {
    data: result,
  };
});
