import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { suggestTitles } from '@/lib/suggestions';

/** GET /api/suggestions/titles?q=&locale=&context=job — title/category autocomplete. */
export const GET = route(async (req: NextRequest) => {
  await requireUser();
  const url = new URL(req.url);
  const context = url.searchParams.get('context') === 'job' ? 'job' : 'listing';
  const suggestions = await suggestTitles(
    url.searchParams.get('q') ?? '',
    url.searchParams.get('locale') ?? 'en',
    context
  );
  return jsonOk({ suggestions });
});
