import type { NextRequest } from 'next/server';
import { route, jsonOk, jsonError } from '@/lib/api';
import { env } from '@/lib/env';
import { createBackup, pruneExpiredBackups } from '@/lib/backup/engine';
import { runIntegrityScan } from '@/lib/backup/integrity';

export const dynamic = 'force-dynamic';

/**
 * Automated scheduled backup runner (Section 1.2).
 * Runs daily or per cron schedule. Authenticated via CRON_SECRET.
 */
async function handle(req: NextRequest): Promise<Response> {
  const secret = process.env.CRON_SECRET || env.AUTH_SECRET;
  const provided =
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.headers.get('x-cron-secret');

  if (provided !== secret) {
    return jsonError('UNAUTHORIZED', 'Invalid cron secret.');
  }

  // 1. Check if full backup exists in past 24h; if so, create INCREMENTAL, else FULL
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentFull = await import('@/lib/prisma').then(({ prisma }) =>
    prisma.backupRecord.findFirst({
      where: { type: 'FULL', status: 'SUCCESS', createdAt: { gte: yesterday } },
    })
  );

  const backupType = recentFull ? 'INCREMENTAL' : 'FULL';
  const backup = await createBackup({
    type: backupType,
    notes: `Automated scheduled ${backupType.toLowerCase()} backup`,
  });

  // 2. Prune expired backups
  const pruneResult = await pruneExpiredBackups();

  // 3. Run automated integrity check
  const integrityResult = await runIntegrityScan(null);

  return jsonOk({
    success: true,
    backup: {
      id: backup.id,
      filename: backup.filename,
      type: backup.type,
      sizeBytes: backup.sizeBytes,
      recordCount: backup.recordCount,
    },
    prunedCount: pruneResult.deletedCount,
    integrityStatus: integrityResult.status,
    integrityIssuesCount: integrityResult.issuesCount,
  });
}

export const GET = route(handle);
export const POST = route(handle);
