import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { suggestFaculties } from '@/lib/cv-suggestions';

/** GET /api/suggestions/faculties?universityId=&q=&locale= — empty until a university is chosen. */
export const GET = route(async (req: NextRequest) => {
  await requireUser();
  const url = new URL(req.url);
  return jsonOk({
    faculties: await suggestFaculties(
      url.searchParams.get('universityId') ?? '',
      url.searchParams.get('q') ?? '',
      url.searchParams.get('locale') ?? 'en'
    ),
  });
});
