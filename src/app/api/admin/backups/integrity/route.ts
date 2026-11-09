import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { runIntegrityScan } from '@/lib/backup/integrity';

/**
 * GET /api/admin/backups/integrity — Get latest scan report & past scan history.
 */
export const GET = adminRoute('backup.view', async () => {
  const [latestScan, history] = await Promise.all([
    prisma.dataIntegrityScan.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        scannedBy: { select: { id: true, fullName: true } },
      },
    }),
    prisma.dataIntegrityScan.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        issuesCount: true,
        recordsScanned: true,
        filesScanned: true,
        durationMs: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    data: {
      latestScan,
      history,
    },
  };
});

/**
 * POST /api/admin/backups/integrity — Trigger immediate live data loss & corruption scan.
 */
export const POST = adminRoute('backup.view', async (_req, _ctx, { admin }) => {
  const scanResult = await runIntegrityScan(admin.id);

  // Log scan action
  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: 'integrity.scan',
      targetType: 'SYSTEM',
      targetId: scanResult.scanId,
      reason: `Completed integrity scan: ${scanResult.issuesCount} issues found (${scanResult.criticalCount} critical)`,
      after: {
        issuesCount: scanResult.issuesCount,
        criticalCount: scanResult.criticalCount,
        status: scanResult.status,
      },
    },
  });

  return {
    data: scanResult,
  };
});
