import { setRequestLocale } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { AdminBackups } from '@/components/admin/admin-backups';

export const dynamic = 'force-dynamic';

export default async function AdminBackupsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);

  const [rawBackups, stats, lastSuccessful, scan] = await Promise.all([
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
      include: {
        scannedBy: { select: { fullName: true } },
      },
    }),
  ]);

  const totalStorageBytes = stats._sum.sizeBytes || 0;
  const totalRecords = stats._sum.recordCount || 0;
  const totalBackups = stats._count.id || 0;

  const nextScheduled = new Date();
  nextScheduled.setUTCHours(2, 0, 0, 0);
  if (nextScheduled.getTime() <= Date.now()) {
    nextScheduled.setUTCDate(nextScheduled.getUTCDate() + 1);
  }

  const initialStats = {
    totalBackups,
    totalStorageBytes,
    totalStorageFormatted: (totalStorageBytes / (1024 * 1024)).toFixed(2) + ' MB',
    totalRecords,
    lastSuccessfulAt: lastSuccessful?.createdAt?.toISOString() ?? null,
    lastSuccessfulType: lastSuccessful?.type ?? null,
    nextScheduledAt: nextScheduled.toISOString(),
    systemHealth: (scan?.status === 'ISSUES_FOUND' ? 'ATTENTION_REQUIRED' : scan?.status === 'FAILED' ? 'FAILED' : 'HEALTHY') as 'HEALTHY' | 'ATTENTION_REQUIRED' | 'FAILED',
    latestIntegrityIssuesCount: scan?.issuesCount || 0,
  };

  const initialBackups = rawBackups.map((b) => ({
    id: b.id,
    filename: b.filename,
    type: b.type,
    status: b.status,
    sizeBytes: b.sizeBytes,
    recordCount: b.recordCount,
    fileCount: b.fileCount,
    scope: b.scope,
    checksumSha256: b.checksumSha256,
    storageLocation: b.storageLocation,
    notes: b.notes,
    createdAt: b.createdAt.toISOString(),
    expiresAt: b.expiresAt ? b.expiresAt.toISOString() : null,
    createdBy: b.createdBy ? { fullName: b.createdBy.fullName, email: b.createdBy.email || '' } : null,
  }));

  const initialScan = scan
    ? {
        id: scan.id,
        status: scan.status as 'COMPLETED' | 'ISSUES_FOUND' | 'FAILED',
        issuesCount: scan.issuesCount,
        issues: (scan.issues as any) || [],
        recordsScanned: scan.recordsScanned,
        filesScanned: scan.filesScanned,
        durationMs: scan.durationMs,
        createdAt: scan.createdAt.toISOString(),
        scannedBy: scan.scannedBy,
      }
    : null;

  return (
    <div className="space-y-6">
      <AdminBackups
        initialBackups={initialBackups}
        initialStats={initialStats}
        initialScan={initialScan}
      />
    </div>
  );
}
