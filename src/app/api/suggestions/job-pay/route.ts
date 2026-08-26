import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { suggestJobPay } from '@/lib/suggestions';

/**
 * GET /api/suggestions/job-pay?type=GIG&location= — suggested pay range from
 * recent comparable postings (Employer §3 Step 3). Never auto-sets pay.
 */
export const GET = route(async (req: NextRequest) => {
  await requireUser();
  const url = new URL(req.url);
  const type = url.searchParams.get('type') === 'GIG' ? 'GIG' : 'JOB';
  const location = url.searchParams.get('location') ?? undefined;
  return jsonOk(await suggestJobPay(type, location));
});
