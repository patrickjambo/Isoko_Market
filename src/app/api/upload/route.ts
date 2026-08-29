import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { saveFile, saveFileFromUrl } from '@/lib/storage';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Authenticated image ingest — a file upload (multipart) OR a remote image URL
 * (JSON `{ url }`), which is fetched + stored server-side so it renders through
 * next/image and doesn't depend on the origin. `private=true` routes to the
 * private area used for ID documents / CVs, served only via signed URLs (§10).
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();

  const limit = rateLimit(`upload:${user.id}`, 40, 60 * 60 * 1000);
  if (!limit.success) throw new ApiError('RATE_LIMITED', 'Too many uploads. Try again later.');

  // "Add by URL": the image is fetched + stored server-side (SSRF-guarded in storage).
  if ((req.headers.get('content-type') ?? '').includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    const url = typeof body?.url === 'string' ? body.url : '';
    if (!url) throw new ApiError('BAD_REQUEST', 'Enter a valid image URL.');
    try {
      return jsonOk(await saveFileFromUrl(url, { private: body.private === true }));
    } catch (err) {
      throw new ApiError('BAD_REQUEST', err instanceof Error ? err.message : "Couldn't fetch that image URL.");
    }
  }

  const form = await req.formData();
  const file = form.get('file');
  const isPrivate = form.get('private') === 'true';

  if (!(file instanceof File)) {
    throw new ApiError('BAD_REQUEST', 'No file provided.');
  }

  try {
    const saved = await saveFile(file, { private: isPrivate });
    return jsonOk(saved);
  } catch (err) {
    throw new ApiError('BAD_REQUEST', err instanceof Error ? err.message : 'Upload failed.');
  }
});
