import { z } from 'zod';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { createBackup, pruneExpiredBackups, BACKUP_STORAGE_DIR, DEFAULT_SCOPES } from '@/lib/backup/engine';

// Backup creation can take 30–90s for large databases on Vercel
export const maxDuration = 120;

const createBackupSchema = z.object({
  type: z.enum(['FULL', 'INCREMENTAL', 'SAFETY_SNAPSHOT']).default('FULL'),
  scope: z.array(z.string()).optional(),
  notes: z.string().max(250).optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
});

/**
 * GET /api/admin/backups — List backups, statistics, and storage consumed.
 */
export const GET = adminRoute('backup.view', async () => {
  const [backups, stats, lastSuccessful, scan] = await Promise.all([
    prisma.backupRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.backupRecord.aggregate({
      _sum: { sizeBytes: true, recordCount: true, fileCount: true },
      _count: { id: true },
    }),
    prisma.backupRecord.findFirst({
      where: { status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dataIntegrityScan.findFirst({
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const totalStorageBytes = stats._sum.sizeBytes || 0;
  const totalRecords = stats._sum.recordCount || 0;
  const totalBackups = stats._count.id || 0;

  // Next scheduled daily backup estimation (every 24h at 02:00 AM)
  const nextScheduled = new Date();
  nextScheduled.setUTCHours(2, 0, 0, 0);
  if (nextScheduled.getTime() <= Date.now()) {
    nextScheduled.setUTCDate(nextScheduled.getUTCDate() + 1);
  }

  return {
    data: {
      backups,
      stats: {
        totalBackups,
        totalStorageBytes,
        totalStorageFormatted: (totalStorageBytes / (1024 * 1024)).toFixed(2) + ' MB',
        totalRecords,
        lastSuccessfulAt: lastSuccessful?.createdAt?.toISOString() ?? null,
        lastSuccessfulType: lastSuccessful?.type ?? null,
        nextScheduledAt: nextScheduled.toISOString(),
        systemHealth: scan?.status === 'ISSUES_FOUND' ? 'ATTENTION_REQUIRED' : 'HEALTHY',
        latestIntegrityIssuesCount: scan?.issuesCount || 0,
      },
    },
  };
});

/**
 * POST /api/admin/backups — Create a new backup on demand.
 */
export const POST = adminRoute('backup.create', async (req, _ctx, { admin }) => {
  const body = await req.json().catch(() => ({}));
  const parsed = createBackupSchema.parse(body);

  const backup = await createBackup({
    type: parsed.type,
    scope: parsed.scope,
    createdById: admin.id,
    notes: parsed.notes,
    retentionDays: parsed.retentionDays,
  });

  return {
    data: backup,
  };
});
