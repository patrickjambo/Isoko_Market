import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { presignUpload } from '@/lib/storage';
import { rateLimit } from '@/lib/rate-limit';

const ALLOWED_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png', 'image/avif']);

/**
 * POST /api/upload/presign — issue a presigned PUT URL for a direct browser →
 * S3/R2 upload (bypasses the 4.5 MB serverless body limit). Returns
 * { supported:false } for drivers without direct upload (local / Vercel Blob) so
 * the client falls back to POST /api/upload. Auth'd + rate-limited like the
 * server upload route.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();

  const limit = rateLimit(`upload:${user.id}`, 40, 60 * 60 * 1000);
  if (!limit.success) throw new ApiError('RATE_LIMITED', 'Too many uploads. Try again later.');

  const body = await req.json().catch(() => ({}));
  const contentType = typeof body?.contentType === 'string' ? body.contentType : '';
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new ApiError('BAD_REQUEST', 'Unsupported file type.');
  }

  const presigned = await presignUpload(contentType, body?.private === true);
  if (!presigned) return jsonOk({ supported: false });
  return jsonOk({ supported: true, ...presigned });
});
