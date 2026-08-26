import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { suggestCombinations } from '@/lib/cv-suggestions';

/** GET /api/suggestions/combinations?q=&kind=alevel|tvet&locale= */
export const GET = route(async (req: NextRequest) => {
  await requireUser();
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind') ?? undefined;
  return jsonOk({
    combinations: await suggestCombinations(
      url.searchParams.get('q') ?? '',
      kind,
      url.searchParams.get('locale') ?? 'en'
    ),
  });
});
