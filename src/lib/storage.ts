import 'server-only';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { env } from './env';
import { isBlockedAddress } from './net-guard';

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

  return persistBytes(Buffer.from(await file.arrayBuffer()), file.type, opts.private ?? false);
}

/** Write validated bytes to the configured store and return its URL + key. */
async function persistBytes(bytes: Buffer, type: string, isPrivate: boolean): Promise<SaveResult> {
  const ext = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const key = `${isPrivate ? 'private' : 'public'}/${randomUUID()}.${ext}`;

  if (env.STORAGE_DRIVER === 'local') {
    const dest = path.join(UPLOAD_ROOT, key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, bytes);
    return { url: `/uploads/${key}`, key };
  }

  // TODO(prod): PutObject to S3/R2 here and return the object key. Public files
  // get a CDN URL; private files are returned as keys and resolved with
  // getSignedUrl() below.
  throw new Error(`Storage driver "${env.STORAGE_DRIVER}" not implemented.`);
}

type FetchedImage = { type: string; bytes: Buffer };

/**
 * One HTTP(S) request PINNED to a pre-validated IP: the TCP connection goes to
 * `ip` (via the `lookup` override — no re-resolution, so no DNS-rebinding, and we
 * control the family so a dead IPv6 route can't hang us), while the hostname is
 * still used for TLS/SNI + cert validation + the Host header. Resolves a redirect
 * target, or the image bytes; the body is streamed with a hard size cap.
 */
function requestPinned(
  url: URL,
  ip: string,
  timeoutMs: number
): Promise<{ redirect?: string; image?: FetchedImage }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        host: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: { accept: 'image/*', 'user-agent': 'IsokoMarket/1.0 (+listing image import)' },
        timeout: timeoutMs,
        // Pin the connection to the pre-validated IP. Node calls this with
        // { all: true }, so it expects the array form.
        lookup: (_hostname, options, cb) =>
          options.all ? cb(null, [{ address: ip, family: 4 }]) : cb(null, ip, 4),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          res.resume(); // drain + discard, then follow
          resolve({ redirect: location });
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error("Couldn't fetch that image URL."));
          return;
        }
        const type = String(res.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
        if (!ALLOWED.has(type)) {
          res.destroy();
          reject(new Error('Unsupported file type.'));
          return;
        }
        if (Number(res.headers['content-length'] ?? 0) > MAX_BYTES) {
          res.destroy();
          reject(new Error('File is too large (max 8 MB).'));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_BYTES) {
            res.destroy();
            reject(new Error('File is too large (max 8 MB).'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ image: { type, bytes: Buffer.concat(chunks) } }));
        res.on('error', () => reject(new Error("Couldn't fetch that image URL.")));
      }
    );
    req.on('timeout', () => req.destroy(new Error("Couldn't fetch that image URL.")));
    req.on('error', () => reject(new Error("Couldn't fetch that image URL.")));
    req.end();
  });
}

/**
 * Fetch a URL as an image, SSRF-guarded at EVERY hop: http(s) only, the host is
 * resolved and non-public addresses (loopback/private/link-local/metadata) are
 * refused, then the request is pinned to that IP (see requestPinned). Redirects
 * — which common image CDNs use — are followed manually, re-validating each hop,
 * and capped.
 */
async function fetchImageSafely(rawUrl: string, timeoutMs = 10_000): Promise<FetchedImage> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error('Enter a valid image URL.');
  }

  for (let hop = 0; hop < 5; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Only http(s) image URLs are allowed.');
    }
    // Force IPv4: this environment's IPv6 route is dead and would hang the
    // connect; IPv4 is universal for image hosts.
    const { address } = await lookup(url.hostname, { family: 4 });
    if (isBlockedAddress(address)) throw new Error('That address is not allowed.');

    const result = await requestPinned(url, address, timeoutMs);
    if (result.image) return result.image;
    url = new URL(result.redirect!, url); // re-validated at the top of the next hop
  }
  throw new Error("Couldn't fetch that image URL."); // too many redirects
}

/**
 * Fetch a remote image by URL and store it locally (so it renders through
 * next/image and never depends on the origin staying up). SSRF-guarded — see
 * fetchImageSafely.
 */
export async function saveFileFromUrl(rawUrl: string, opts: { private?: boolean } = {}): Promise<SaveResult> {
  const { type, bytes } = await fetchImageSafely(rawUrl);
  return persistBytes(bytes, type, opts.private ?? false);
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
