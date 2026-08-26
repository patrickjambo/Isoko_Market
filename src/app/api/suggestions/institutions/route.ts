import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { suggestInstitutions, addInstitution } from '@/lib/cv-suggestions';

const TYPES = ['secondary_school', 'university', 'tvet'];

/** GET /api/suggestions/institutions?q=&type= — schools/universities autocomplete. */
export const GET = route(async (req: NextRequest) => {
  await requireUser();
  const url = new URL(req.url);
  const type = url.searchParams.get('type') ?? 'university';
  if (!TYPES.includes(type)) throw new ApiError('BAD_REQUEST', 'Invalid institution type.');
  return jsonOk({ institutions: await suggestInstitutions(url.searchParams.get('q') ?? '', type) });
});

/** POST — "add new" fallback: creates an unverified row for admin review. */
export const POST = route(async (req: NextRequest) => {
  await requireUser();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim();
  const type = String(body.type ?? '');
  if (name.length < 2) throw new ApiError('BAD_REQUEST', 'Enter the institution name.');
  if (!TYPES.includes(type)) throw new ApiError('BAD_REQUEST', 'Invalid institution type.');
  return jsonOk(await addInstitution(name, type), { status: 201 });
});
