import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { saveFile } from '@/lib/storage';
import { rateLimit } from '@/lib/rate-limit';

/**
 * Authenticated file upload. `private=true` routes to the private area used for
 * ID documents / CVs, which are served only via signed URLs (Section 10).
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();

  const limit = rateLimit(`upload:${user.id}`, 40, 60 * 60 * 1000);
  if (!limit.success) throw new ApiError('RATE_LIMITED', 'Too many uploads. Try again later.');

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
