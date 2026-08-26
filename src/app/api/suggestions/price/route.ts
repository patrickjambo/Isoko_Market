import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { suggestPrice } from '@/lib/suggestions';

/** GET /api/suggestions/price?category=&location= — soft suggested price range. */
export const GET = route(async (req: NextRequest) => {
  await requireUser();
  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  if (!category) return jsonOk({ count: 0, min: null, max: null, median: null });
  const result = await suggestPrice(category, url.searchParams.get('location') ?? undefined);
  return jsonOk(result);
});
