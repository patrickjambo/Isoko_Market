import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { suggestLocations } from '@/lib/cv-suggestions';

const LEVELS = ['province', 'district', 'sector', 'cell'];

/** GET /api/suggestions/locations?q=&level=&parentId= — cascading division autocomplete. */
export const GET = route(async (req: NextRequest) => {
  await requireUser();
  const url = new URL(req.url);
  const level = url.searchParams.get('level') ?? 'province';
  if (!LEVELS.includes(level)) throw new ApiError('BAD_REQUEST', 'Invalid division level.');
  return jsonOk({
    locations: await suggestLocations(
      url.searchParams.get('q') ?? '',
      level,
      url.searchParams.get('parentId') ?? undefined
    ),
  });
});
