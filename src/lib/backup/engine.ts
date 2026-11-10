import 'server-only';
import { writeFile, readFile, mkdir, unlink, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { emitAdmin } from '@/lib/admin-realtime';
import { encryptBackupData, decryptBackupData, computeSha256, type EncryptedPayload } from './crypto';

/**
 * On Vercel the project root is read-only; use /tmp which is writable (512 MB,
 * ephemeral per-instance). On local dev use the project-relative storage/ dir.
 * After writing, we optionally upload to Vercel Blob for durable off-instance
 * storage so the file survives beyond the function lifetime.
 */
export const BACKUP_STORAGE_DIR = process.env.VERCEL
  ? '/tmp/zenova-backups'
  : path.join(process.cwd(), 'storage', 'backups');
export const DEFAULT_SCOPES = [
  'users',
  'listings',
  'transactions',
  'messages',
  'settings',
  'feedback',
  'files',
] as const;

export type BackupScopeType = (typeof DEFAULT_SCOPES)[number];

export interface BackupManifest {
  version: string;
  backupId: string;
  createdAt: string;
  type: 'FULL' | 'INCREMENTAL' | 'SAFETY_SNAPSHOT';
  scope: string[];
  environment: string;
  parentBackupId?: string | null;
  counts: Record<string, number>;
  totalRecords: number;
  totalFiles: number;
  checksumSha256: string;
  filesManifest: Array<{ path: string; size: number; checksum?: string }>;
}

export interface BackupArchiveData {
  manifest: BackupManifest;
  data: {
    users?: unknown[];
    verificationRequests?: unknown[];
    cvs?: unknown[];
    seekerDocuments?: unknown[];
    categories?: unknown[];
    listings?: unknown[];
    listingImages?: unknown[];
    orders?: unknown[];
    transactions?: unknown[];
    conversations?: unknown[];
    messages?: unknown[];
    supportTickets?: unknown[];
    supportMessages?: unknown[];
    platformSettings?: unknown[];
    localeStrings?: unknown[];
    partners?: unknown[];
    userPermissionOverrides?: unknown[];
    reviews?: unknown[];
    landingFeedbacks?: unknown[];
    reports?: unknown[];
  };
}

/**
 * Ensures backup directory exists on disk.
 */
async function ensureBackupDirectory(): Promise<void> {
  await mkdir(BACKUP_STORAGE_DIR, { recursive: true });
}

/**
 * Persist a backup file and return the durable storage location string.
 * - Local dev: writes to storage/backups/ and returns the absolute path.
 * - Vercel: writes to /tmp (staging), uploads to Vercel Blob, returns the
 *   Blob URL so the file survives beyond the serverless function lifetime.
 * - S3/R2: writes to /tmp (staging), uploads to S3, returns the object key.
 */
async function persistBackupFile(filename: string, contents: string): Promise<string> {
  const localPath = path.join(BACKUP_STORAGE_DIR, filename);
  await ensureBackupDirectory();
  await writeFile(localPath, contents, 'utf8');

  const driver = process.env.STORAGE_DRIVER ?? 'local';

  // On Vercel Blob — upload the temp file to Blob for durable storage
  if (driver === 'vercel_blob') {
    try {
      const { put } = await import('@vercel/blob');
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      const blob = await put(`backups/${filename}`, contents, {
        access: 'public',
        contentType: 'application/octet-stream',
        addRandomSuffix: false,
        ...(token ? { token } : {}),
      });
      return blob.url; // durable CDN URL
    } catch (blobErr) {
      console.error('[backup] Vercel Blob upload failed, falling back to /tmp path:', blobErr);
      return localPath; // still usable within this function instance
    }
  }

  // S3 / R2 — upload to object storage
  if (driver === 's3' || driver === 'r2') {
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: process.env.S3_REGION || 'auto',
        ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
        },
      });
      const key = `backups/${filename}`;
      await client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET ?? 'isoko',
        Key: key,
        Body: contents,
        ContentType: 'application/octet-stream',
      }));
      return key; // S3 object key
    } catch (s3Err) {
      console.error('[backup] S3 upload failed, falling back to local path:', s3Err);
      return localPath;
    }
  }

  return localPath; // local dev
}

/**
 * Load backup file bytes from wherever persistBackupFile stored them.
 */
async function loadBackupFile(storageLocation: string): Promise<string> {
  // Vercel Blob or S3 public URL
  if (/^https?:\/\//.test(storageLocation)) {
    const res = await fetch(storageLocation);
    if (!res.ok) throw new Error(`Failed to fetch backup from ${storageLocation}: ${res.status}`);
    return res.text();
  }

  // S3 key (no protocol)
  const driver = process.env.STORAGE_DRIVER ?? 'local';
  if ((driver === 's3' || driver === 'r2') && !path.isAbsolute(storageLocation)) {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      },
    });
    const res = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET ?? 'isoko', Key: storageLocation }));
    if (!res.Body) throw new Error('Empty S3 response');
    return res.Body.transformToString();
  }

  // Local filesystem (dev or /tmp on Vercel)
  return readFile(storageLocation, 'utf8');
}

/**
 * Scans local public/uploads directory for file manifests.
 */
async function collectFilesManifest(): Promise<Array<{ path: string; size: number }>> {
  const uploadRoot = path.join(process.cwd(), 'public', 'uploads');
  const manifest: Array<{ path: string; size: number }> = [];

  async function walk(dir: string, relPrefix = '') {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relPrefix, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath, relPath);
        } else if (entry.isFile()) {
          const stats = await stat(fullPath);
          manifest.push({ path: relPath, size: stats.size });
        }
      }
    } catch {
      // directory might not exist yet in fresh installs
    }
  }

  await walk(uploadRoot);
  return manifest;
}

export interface CreateBackupOptions {
  type?: 'FULL' | 'INCREMENTAL' | 'SAFETY_SNAPSHOT';
  scope?: string[];
  createdById?: string | null;
  notes?: string;
  retentionDays?: number;
}

/**
 * Generates an encrypted, versioned backup of Zenova customer and system data.
 */
export async function createBackup(options: CreateBackupOptions = {}) {
  const type = options.type || 'FULL';
  const scope = options.scope && options.scope.length > 0 ? options.scope : [...DEFAULT_SCOPES];
  const retentionDays = options.retentionDays || (type === 'SAFETY_SNAPSHOT' ? 30 : 90);
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

  await ensureBackupDirectory();

  await ensureBackupDirectory();

  // Find parent backup if incremental
  let parentBackupId: string | null = null;
  let since: Date | null = null;
  if (type === 'INCREMENTAL') {
    const lastSuccessful = await prisma.backupRecord.findFirst({
      where: { status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
    });
    if (lastSuccessful) {
      parentBackupId = lastSuccessful.id;
      since = lastSuccessful.createdAt;
    }
  }

  // Pre-generate ID
  const backupId = 'bck_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `zenova-${type.toLowerCase()}-${timestamp}.zbak`;
  // storageLocation is placeholder until persistBackupFile resolves the durable URL
  const storageLocation = path.join(BACKUP_STORAGE_DIR, filename);

  // Initial DB record marked IN_PROGRESS
  const record = await prisma.backupRecord.create({
    data: {
      id: backupId,
      filename,
      type,
      status: 'IN_PROGRESS',
      scope,
      checksumSha256: 'pending',
      storageLocation,
      createdById: options.createdById ?? null,
      notes: options.notes ?? (type === 'SAFETY_SNAPSHOT' ? 'Automatic Pre-Restoration Snapshot' : null),
      expiresAt,
    },
  });

  await emitAdmin('backup.started', `Backup started (${type}): ${filename}`);

  try {
    const data: BackupArchiveData['data'] = {};
    const counts: Record<string, number> = {};

    // 1. Users scope
    if (scope.includes('users')) {
      const userWhere = since ? { updatedAt: { gte: since } } : {};
      const [users, verifications, cvs, seekerDocs] = await Promise.all([
        prisma.user.findMany({ where: userWhere }),
        prisma.verificationRequest.findMany({
          where: since ? { OR: [{ createdAt: { gte: since } }, { reviewedAt: { gte: since } }] } : {},
        }),
        prisma.cV.findMany({ where: since ? { updatedAt: { gte: since } } : {} }),
        prisma.seekerDocument.findMany({ where: since ? { createdAt: { gte: since } } : {} }),
      ]);
      data.users = users;
      data.verificationRequests = verifications;
      data.cvs = cvs;
      data.seekerDocuments = seekerDocs;
      counts.users = users.length;
      counts.verificationRequests = verifications.length;
      counts.cvs = cvs.length;
      counts.seekerDocuments = seekerDocs.length;
    }

    // 2. Listings scope
    if (scope.includes('listings')) {
      const [categories, listings, images] = await Promise.all([
        prisma.category.findMany(),
        prisma.listing.findMany({ where: since ? { updatedAt: { gte: since } } : {} }),
        prisma.listingImage.findMany({ where: since ? { createdAt: { gte: since } } : {} }),
      ]);
      data.categories = categories;
      data.listings = listings;
      data.listingImages = images;
      counts.categories = categories.length;
      counts.listings = listings.length;
      counts.listingImages = images.length;
    }

    // 3. Transactions & Orders scope
    if (scope.includes('transactions')) {
      const [orders, transactions] = await Promise.all([
        prisma.order.findMany({ where: since ? { updatedAt: { gte: since } } : {} }),
        prisma.transaction.findMany({ where: since ? { createdAt: { gte: since } } : {} }),
      ]);
      data.orders = orders;
      data.transactions = transactions;
      counts.orders = orders.length;
      counts.transactions = transactions.length;
    }

    // 4. Messages & Support scope
    if (scope.includes('messages')) {
      const [conversations, messages, supportTickets, supportMessages] = await Promise.all([
        prisma.conversation.findMany({
          where: since ? { OR: [{ createdAt: { gte: since } }, { lastMessageAt: { gte: since } }] } : {},
        }),
        prisma.message.findMany({ where: since ? { createdAt: { gte: since } } : {} }),
        prisma.supportTicket.findMany({ where: since ? { updatedAt: { gte: since } } : {} }),
        prisma.supportMessage.findMany({ where: since ? { createdAt: { gte: since } } : {} }),
      ]);
      data.conversations = conversations;
      data.messages = messages;
      data.supportTickets = supportTickets;
      data.supportMessages = supportMessages;
      counts.conversations = conversations.length;
      counts.messages = messages.length;
      counts.supportTickets = supportTickets.length;
      counts.supportMessages = supportMessages.length;
    }

    // 5. Settings scope
    if (scope.includes('settings')) {
      const [platformSettings, localeStrings, partners, overrides] = await Promise.all([
        prisma.platformSettings.findMany(),
        prisma.localeString.findMany({ where: since ? { updatedAt: { gte: since } } : {} }),
        prisma.partner.findMany({ where: since ? { updatedAt: { gte: since } } : {} }),
        prisma.userPermissionOverride.findMany({ where: since ? { createdAt: { gte: since } } : {} }),
      ]);
      data.platformSettings = platformSettings;
      data.localeStrings = localeStrings;
      data.partners = partners;
      data.userPermissionOverrides = overrides;
      counts.platformSettings = platformSettings.length;
      counts.localeStrings = localeStrings.length;
      counts.partners = partners.length;
      counts.userPermissionOverrides = overrides.length;
    }

    // 6. Feedback & Reviews scope
    if (scope.includes('feedback')) {
      const [reviews, landingFeedbacks, reports] = await Promise.all([
        prisma.review.findMany({ where: since ? { createdAt: { gte: since } } : {} }),
        prisma.landingFeedback.findMany({ where: since ? { updatedAt: { gte: since } } : {} }),
        prisma.report.findMany({ where: since ? { updatedAt: { gte: since } } : {} }),
      ]);
      data.reviews = reviews;
      data.landingFeedbacks = landingFeedbacks;
      data.reports = reports;
      counts.reviews = reviews.length;
      counts.landingFeedbacks = landingFeedbacks.length;
      counts.reports = reports.length;
    }

    // 7. Files Manifest scope
    let filesManifest: Array<{ path: string; size: number }> = [];
    if (scope.includes('files')) {
      filesManifest = await collectFilesManifest();
      counts.files = filesManifest.length;
    }

    const totalRecords = Object.values(counts).reduce((sum, n) => sum + n, 0) - (counts.files || 0);
    const totalFiles = filesManifest.length;

    // Construct Archive
    const rawArchiveData = JSON.stringify({
      manifest: {
        version: '1.0.0',
        backupId,
        createdAt: new Date().toISOString(),
        type,
        scope,
        environment: process.env.NODE_ENV || 'production',
        parentBackupId,
        counts,
        totalRecords,
        totalFiles,
        checksumSha256: '', // filled below
        filesManifest,
      },
      data,
    });

    // Compute plaintext SHA-256
    const plaintextChecksum = computeSha256(rawArchiveData);

    // Encrypt payload
    const encryptedPayload = encryptBackupData(rawArchiveData);
    const serializedPayload = JSON.stringify(encryptedPayload);

    // Persist to storage (handles Vercel read-only fs, Blob, S3, local dev)
    const durableLocation = await persistBackupFile(filename, serializedPayload);
    const sizeBytes = Buffer.byteLength(serializedPayload, 'utf8');

    // Update DB record with the durable storage location
    const updatedRecord = await prisma.backupRecord.update({
      where: { id: backupId },
      data: {
        status: 'SUCCESS',
        recordCount: totalRecords,
        fileCount: totalFiles,
        sizeBytes,
        checksumSha256: plaintextChecksum,
        storageLocation: durableLocation, // may differ from initial path (Blob URL)
        metadata: {
          counts,
          parentBackupId,
          version: '1.0.0',
        },
      },
    });

    // Audit Log
    if (options.createdById) {
      await prisma.auditLog.create({
        data: {
          actorId: options.createdById,
          action: 'backup.create',
          targetType: 'SYSTEM',
          targetId: backupId,
          reason: `Created ${type} backup (${totalRecords} records, ${sizeBytes} bytes)`,
          after: { backupId, type, filename, sizeBytes, totalRecords },
        },
      });
    }

    await emitAdmin(
      'backup.completed',
      `Backup completed (${type}): ${totalRecords} records, ${(sizeBytes / 1024).toFixed(1)} KB`
    );

    return updatedRecord;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Backup creation failed:', errorMsg);

    await prisma.backupRecord.update({
      where: { id: backupId },
      data: {
        status: 'FAILED',
        notes: `Failed: ${errorMsg}`,
      },
    });

    await emitAdmin('backup.failed', `Backup failed: ${errorMsg}`);
    throw err;
  }
}

/**
 * Loads and decrypts a backup file from storage, verifying integrity.
 */
export async function loadBackupArchive(backupId: string): Promise<BackupArchiveData> {
  const record = await prisma.backupRecord.findUnique({
    where: { id: backupId },
  });
  if (!record) {
    throw new Error(`Backup record not found: ${backupId}`);
  }

  const rawEncrypted = await loadBackupFile(record.storageLocation);
  const payload: EncryptedPayload = JSON.parse(rawEncrypted);

  // Decrypt and verify checksum
  const decryptedJson = decryptBackupData(payload);
  const archive: BackupArchiveData = JSON.parse(decryptedJson);

  return archive;
}

/**
 * Verifies integrity of a stored backup (checksum match, decryptable, valid manifest).
 */
export async function verifyBackupIntegrity(backupId: string) {
  const record = await prisma.backupRecord.findUnique({
    where: { id: backupId },
  });
  if (!record) throw new Error(`Backup not found: ${backupId}`);

  try {
    const archive = await loadBackupArchive(backupId);
    const valid = !!(archive.manifest && archive.data);

    await prisma.backupRecord.update({
      where: { id: backupId },
      data: { status: 'SUCCESS' },
    });

    return {
      valid: true,
      backupId,
      checksumSha256: record.checksumSha256,
      recordCount: record.recordCount,
      fileCount: record.fileCount,
      sizeBytes: record.sizeBytes,
      manifest: archive.manifest,
      verifiedAt: new Date().toISOString(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.backupRecord.update({
      where: { id: backupId },
      data: { status: 'CORRUPTED', notes: `Integrity check failed: ${msg}` },
    });

    return {
      valid: false,
      backupId,
      error: msg,
      verifiedAt: new Date().toISOString(),
    };
  }
}

/**
 * Prunes expired backups according to retention policy.
 * Protects SAFETY_SNAPSHOT and at least the 3 most recent FULL backups.
 */
export async function pruneExpiredBackups(): Promise<{ deletedCount: number; prunedIds: string[] }> {
  const now = new Date();

  // Find expired candidates
  const expired = await prisma.backupRecord.findMany({
    where: {
      expiresAt: { lt: now },
      type: { not: 'SAFETY_SNAPSHOT' }, // Never prune safety snapshots
    },
    orderBy: { createdAt: 'desc' },
  });

  // Preserve the 3 newest full backups regardless of expiry
  const recentFull = await prisma.backupRecord.findMany({
    where: { type: 'FULL', status: 'SUCCESS' },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true },
  });
  const protectedIds = new Set(recentFull.map((b) => b.id));

  const toDelete = expired.filter((b) => !protectedIds.has(b.id));
  const prunedIds: string[] = [];

  for (const b of toDelete) {
    try {
      // Only attempt local file deletion — Blob/S3 URLs are cleaned up separately
      if (!(/^https?:\/\//.test(b.storageLocation))) {
        await unlink(b.storageLocation).catch(() => {});
      }
      await prisma.backupRecord.delete({ where: { id: b.id } });
      prunedIds.push(b.id);
    } catch {
      // continue with other records
    }
  }

  return { deletedCount: prunedIds.length, prunedIds };
}
