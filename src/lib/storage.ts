import 'server-only';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { env } from './env';

/**
 * File storage abstraction (Section 4.1 / 6.4). In dev (STORAGE_DRIVER=local)
 * files are written under /public/uploads. Private files (ID documents, CVs)
 * go under /uploads/private and, in production, must be served only via signed,
 * expiring URLs from S3/R2 (Section 10). The `private` flag is what a real
 * driver uses to pick the private bucket + signed-URL policy.
 */
const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

export type SaveResult = { url: string; key: string };

const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'application/pdf',
]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function saveFile(
  file: File,
  opts: { private?: boolean } = {}
): Promise<SaveResult> {
  if (!ALLOWED.has(file.type)) {
    throw new Error('Unsupported file type.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('File is too large (max 8 MB).');
  }

  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const folder = opts.private ? 'private' : 'public';
  const key = `${folder}/${randomUUID()}.${ext}`;

  if (env.STORAGE_DRIVER === 'local') {
    const dest = path.join(UPLOAD_ROOT, key);
    await mkdir(path.dirname(dest), { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(dest, bytes);
    return { url: `/uploads/${key}`, key };
  }

  // TODO(prod): PutObject to S3/R2 here and return the object key. Public files
  // get a CDN URL; private files are returned as keys and resolved with
  // getSignedUrl() below.
  throw new Error(`Storage driver "${env.STORAGE_DRIVER}" not implemented.`);
}

/**
 * Resolve a private object key to a viewable URL. In production this returns a
 * short-lived signed URL; in local dev the file is already under /public.
 */
export function getSignedUrl(key: string): string {
  if (env.STORAGE_DRIVER === 'local') return `/uploads/${key}`;
  // TODO(prod): return S3/R2 presigned GET URL with a short TTL.
  return `/uploads/${key}`;
}
