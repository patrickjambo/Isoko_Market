import 'server-only';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { emitAdmin } from '@/lib/admin-realtime';

export type IssueSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface IntegrityIssue {
  id: string;
  severity: IssueSeverity;
  category: 'ORPHAN_RECORD' | 'CORRUPTED_DATA' | 'MISSING_FILE' | 'DATA_DROP' | 'BACKUP_FAILURE';
  entity: string;
  entityId?: string;
  description: string;
  detectedAt: string;
  recommendation: string;
  lastGoodBackupId?: string | null;
}

export interface IntegrityScanResult {
  scanId: string;
  status: 'COMPLETED' | 'ISSUES_FOUND' | 'FAILED';
  issuesCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  issues: IntegrityIssue[];
  recordsScanned: number;
  filesScanned: number;
  durationMs: number;
  createdAt: string;
}

/**
 * Checks if a relative upload file exists on disk.
 */
async function fileExists(relPath: string): Promise<boolean> {
  try {
    const cleanRel = relPath.startsWith('/') ? relPath.slice(1) : relPath;
    const fullPath = path.join(process.cwd(), 'public', cleanRel);
    const s = await stat(fullPath);
    return s.isFile();
  } catch {
    return false;
  }
}

/**
 * Runs a comprehensive Data Loss and Failure Detection scan across the system.
 */
export async function runIntegrityScan(scannedById?: string | null): Promise<IntegrityScanResult> {
  const start = Date.now();
  const issues: IntegrityIssue[] = [];
  let recordsScanned = 0;
  let filesScanned = 0;

  // Retrieve last successful backup for historical baseline comparison
  const lastGoodBackup = await prisma.backupRecord.findFirst({
    where: { status: 'SUCCESS' },
    orderBy: { createdAt: 'desc' },
  });

  try {
    // 1. Check for dangling foreign keys (Orphan Records)
    const [
      orphanListings,
      orphanImages,
      orphanOrders,
      orphanTickets,
      orphanVerifications,
    ] = await Promise.all([
      // Listings whose seller doesn't exist
      prisma.$queryRaw<Array<{ id: string; title: string }>>`
        SELECT id, title FROM "Listing" WHERE "sellerId" NOT IN (SELECT id FROM "User") LIMIT 50
      `,
      // Listing images without listings
      prisma.$queryRaw<Array<{ id: string; url: string }>>`
        SELECT id, url FROM "ListingImage" WHERE "listingId" NOT IN (SELECT id FROM "Listing") LIMIT 50
      `,
      // Orders without buyer or seller
      prisma.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status FROM "Order" WHERE "buyerId" NOT IN (SELECT id FROM "User") OR "sellerId" NOT IN (SELECT id FROM "User") LIMIT 50
      `,
      // Support tickets without user
      prisma.$queryRaw<Array<{ id: string; subject: string }>>`
        SELECT id, subject FROM "SupportTicket" WHERE "userId" NOT IN (SELECT id FROM "User") LIMIT 50
      `,
      // Verification requests without user
      prisma.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status FROM "VerificationRequest" WHERE "userId" NOT IN (SELECT id FROM "User") LIMIT 50
      `,
    ]);

    recordsScanned += 500;

    for (const l of orphanListings) {
      issues.push({
        id: `iss_orph_list_${l.id}`,
        severity: 'CRITICAL',
        category: 'ORPHAN_RECORD',
        entity: 'Listing',
        entityId: l.id,
        description: `Listing "${l.title}" (ID: ${l.id}) references a non-existent seller account.`,
        detectedAt: new Date().toISOString(),
        recommendation: 'Restore the seller account from backup or safely archive this listing.',
        lastGoodBackupId: lastGoodBackup?.id ?? null,
      });
    }

    for (const img of orphanImages) {
      issues.push({
        id: `iss_orph_img_${img.id}`,
        severity: 'WARNING',
        category: 'ORPHAN_RECORD',
        entity: 'ListingImage',
        entityId: img.id,
        description: `Image (ID: ${img.id}) has no associated listing.`,
        detectedAt: new Date().toISOString(),
        recommendation: 'Prune orphan image record or attach to target listing.',
      });
    }

    for (const ord of orphanOrders) {
      issues.push({
        id: `iss_orph_ord_${ord.id}`,
        severity: 'CRITICAL',
        category: 'ORPHAN_RECORD',
        entity: 'Order',
        entityId: ord.id,
        description: `Order (ID: ${ord.id}) is missing buyer or seller reference.`,
        detectedAt: new Date().toISOString(),
        recommendation: 'Restore missing user accounts from backup immediately.',
        lastGoodBackupId: lastGoodBackup?.id ?? null,
      });
    }

    for (const v of orphanVerifications) {
      issues.push({
        id: `iss_orph_ver_${v.id}`,
        severity: 'WARNING',
        category: 'ORPHAN_RECORD',
        entity: 'VerificationRequest',
        entityId: v.id,
        description: `Verification request (ID: ${v.id}) is missing its user account.`,
        detectedAt: new Date().toISOString(),
        recommendation: 'Review and remove orphan verification row.',
      });
    }

    // 2. Corrupted data detection
    const [corruptListings, corruptOrders] = await Promise.all([
      prisma.listing.findMany({
        where: { price: { lt: 0 } },
        select: { id: true, title: true, price: true },
        take: 20,
      }),
      prisma.order.findMany({
        where: { amount: { lt: 0 } },
        select: { id: true, amount: true },
        take: 20,
      }),
    ]);

    recordsScanned += corruptListings.length + corruptOrders.length;

    for (const cl of corruptListings) {
      issues.push({
        id: `iss_corr_list_${cl.id}`,
        severity: 'CRITICAL',
        category: 'CORRUPTED_DATA',
        entity: 'Listing',
        entityId: cl.id,
        description: `Listing "${cl.title}" has an invalid negative price (${cl.price} RWF).`,
        detectedAt: new Date().toISOString(),
        recommendation: 'Correct price to 0 (free/negotiable) or restore previous valid state.',
      });
    }

    for (const co of corruptOrders) {
      issues.push({
        id: `iss_corr_ord_${co.id}`,
        severity: 'CRITICAL',
        category: 'CORRUPTED_DATA',
        entity: 'Order',
        entityId: co.id,
        description: `Order (ID: ${co.id}) has a corrupted negative amount (${co.amount} RWF).`,
        detectedAt: new Date().toISOString(),
        recommendation: 'Audit financial transactions and restore order details.',
      });
    }

    // 3. Missing uploaded documents or images verification
    const recentImages = await prisma.listingImage.findMany({
      take: 60,
      orderBy: { createdAt: 'desc' },
      select: { id: true, url: true, listingId: true },
    });

    for (const img of recentImages) {
      filesScanned++;
      if (img.url.startsWith('/uploads/') || img.url.startsWith('uploads/')) {
        const exists = await fileExists(img.url);
        if (!exists) {
          issues.push({
            id: `iss_miss_file_${img.id}`,
            severity: 'WARNING',
            category: 'MISSING_FILE',
            entity: 'ListingImage',
            entityId: img.id,
            description: `Media file referenced at "${img.url}" is missing from storage.`,
            detectedAt: new Date().toISOString(),
            recommendation: 'Restore uploaded media from backup archive.',
            lastGoodBackupId: lastGoodBackup?.id ?? null,
          });
        }
      }
    }

    // 4. Incomplete or failed backups detection
    const stalledBackups = await prisma.backupRecord.findMany({
      where: {
        OR: [
          { status: 'FAILED' },
          { status: 'CORRUPTED' },
          {
            status: 'IN_PROGRESS',
            createdAt: { lt: new Date(Date.now() - 15 * 60 * 1000) }, // Stalled > 15m
          },
        ],
      },
      select: { id: true, filename: true, status: true, createdAt: true, notes: true },
      take: 10,
    });

    for (const sb of stalledBackups) {
      issues.push({
        id: `iss_stalled_bck_${sb.id}`,
        severity: sb.status === 'CORRUPTED' ? 'CRITICAL' : 'WARNING',
        category: 'BACKUP_FAILURE',
        entity: 'BackupRecord',
        entityId: sb.id,
        description: `Backup ${sb.filename} is in status ${sb.status}${sb.notes ? `: ${sb.notes}` : ''}.`,
        detectedAt: new Date().toISOString(),
        recommendation: 'Execute a fresh full backup immediately to ensure data safety.',
      });
    }

    // 5. Baseline Count Drop Comparison (Accidental deletion check)
    if (lastGoodBackup?.metadata && typeof lastGoodBackup.metadata === 'object') {
      const meta = lastGoodBackup.metadata as { counts?: Record<string, number> };
      if (meta.counts) {
        const currentUsers = await prisma.user.count();
        const currentListings = await prisma.listing.count();
        recordsScanned += currentUsers + currentListings;

        const previousUsers = meta.counts.users || 0;
        const previousListings = meta.counts.listings || 0;

        // If records dropped by > 20% compared to previous full backup
        if (previousUsers > 10 && currentUsers < previousUsers * 0.8) {
          issues.push({
            id: 'iss_drop_users',
            severity: 'CRITICAL',
            category: 'DATA_DROP',
            entity: 'User',
            description: `Customer count dropped from ${previousUsers} to ${currentUsers} (-${Math.round(
              ((previousUsers - currentUsers) / previousUsers) * 100
            )}%). Possible mass deletion detected.`,
            detectedAt: new Date().toISOString(),
            recommendation: `Inspect audit logs and consider selective restoration from backup ${lastGoodBackup.filename}.`,
            lastGoodBackupId: lastGoodBackup.id,
          });
        }

        if (previousListings > 10 && currentListings < previousListings * 0.75) {
          issues.push({
            id: 'iss_drop_listings',
            severity: 'WARNING',
            category: 'DATA_DROP',
            entity: 'Listing',
            description: `Active listing count dropped from ${previousListings} to ${currentListings}.`,
            detectedAt: new Date().toISOString(),
            recommendation: 'Verify if listings expired via cron or were deleted accidentally.',
            lastGoodBackupId: lastGoodBackup.id,
          });
        }
      }
    }

    const durationMs = Date.now() - start;
    const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length;
    const warningCount = issues.filter((i) => i.severity === 'WARNING').length;
    const infoCount = issues.filter((i) => i.severity === 'INFO').length;
    const status = issues.length > 0 ? 'ISSUES_FOUND' : 'COMPLETED';

    const scanRecord = await prisma.dataIntegrityScan.create({
      data: {
        status,
        issuesCount: issues.length,
        issues: issues as unknown as object,
        recordsScanned,
        filesScanned,
        scannedById: scannedById ?? null,
        durationMs,
      },
    });

    if (criticalCount > 0) {
      await emitAdmin(
        'integrity.critical',
        `Data Integrity Alert: ${criticalCount} critical issues detected during scan`
      );
    }

    return {
      scanId: scanRecord.id,
      status,
      issuesCount: issues.length,
      criticalCount,
      warningCount,
      infoCount,
      issues,
      recordsScanned,
      filesScanned,
      durationMs,
      createdAt: scanRecord.createdAt.toISOString(),
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Integrity scan failed:', errorMsg);

    const scanRecord = await prisma.dataIntegrityScan.create({
      data: {
        status: 'FAILED',
        issuesCount: 1,
        issues: [
          {
            id: 'scan_failed',
            severity: 'CRITICAL',
            category: 'CORRUPTED_DATA',
            entity: 'System',
            description: `Scan process failed: ${errorMsg}`,
            detectedAt: new Date().toISOString(),
            recommendation: 'Review database server health and retry.',
          },
        ] as unknown as object,
        durationMs: Date.now() - start,
      },
    });

    return {
      scanId: scanRecord.id,
      status: 'FAILED',
      issuesCount: 1,
      criticalCount: 1,
      warningCount: 0,
      infoCount: 0,
      issues: [
        {
          id: 'scan_failed',
          severity: 'CRITICAL',
          category: 'CORRUPTED_DATA',
          entity: 'System',
          description: `Scan process failed: ${errorMsg}`,
          detectedAt: new Date().toISOString(),
          recommendation: 'Review database server health and retry.',
        },
      ],
      recordsScanned,
      filesScanned,
      durationMs: Date.now() - start,
      createdAt: scanRecord.createdAt.toISOString(),
    };
  }
}
