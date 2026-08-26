import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { suggestTags } from '@/lib/suggestions';

/** GET /api/suggestions/tags?category= — most-used tags in the category. */
export const GET = route(async (req: NextRequest) => {
  await requireUser();
  const category = new URL(req.url).searchParams.get('category');
  const tags = category ? await suggestTags(category) : [];
  return jsonOk({ tags });
});
