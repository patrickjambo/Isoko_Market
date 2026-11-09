import { readFile } from 'node:fs/promises';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api';

/**
 * GET /api/admin/backups/[id]/download — Download the backup archive.
 */
export const GET = adminRoute('backup.download', async (_req, ctx: { params: { id: string } }, { admin }) => {
  const backup = await prisma.backupRecord.findUnique({
    where: { id: ctx.params.id },
  });

  if (!backup) {
    throw new ApiError('NOT_FOUND', 'Backup not found');
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(backup.storageLocation);
  } catch {
    throw new ApiError('INTERNAL', 'Backup file could not be read from disk.');
  }

  // Audit log download
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'backup.download',
      targetType: 'SYSTEM',
      targetId: backup.id,
      reason: `Downloaded backup archive ${backup.filename} (${backup.sizeBytes} bytes)`,
    },
  });

  return new Response(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${backup.filename}"`,
      'Content-Length': fileBuffer.length.toString(),
      'X-Checksum-SHA256': backup.checksumSha256,
    },
  });
});
