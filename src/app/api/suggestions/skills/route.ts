import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { searchSkills } from '@/lib/skills';

/**
 * GET /api/suggestions/skills?q=&locale= — search-as-you-type over the shared
 * skills taxonomy (Job Seeker spec §2/§3/§10). One vocabulary for the CV
 * builder, the employer job form and job search, so match scores are meaningful.
 */
export const GET = route(async (req: NextRequest) => {
  await requireUser();
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const locale = url.searchParams.get('locale') ?? 'en';
  return jsonOk({ skills: searchSkills(q, locale) });
});
