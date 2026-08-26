import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { savedSearchSchema } from '@/lib/validators/job';
import { canonicalSkill } from '@/lib/skills';

/** GET /api/saved-searches — the seeker's stored "notify me" searches (§8). */
export const GET = route(async () => {
  const user = await requireUser();
  const items = await prisma.savedSearch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  return jsonOk({ items });
});

/** POST /api/saved-searches — save the current filter as a live notify-me rule. */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const input = savedSearchSchema.parse(await req.json().catch(() => ({})));

  const skills = Array.from(new Set(input.skills.map(canonicalSkill).filter(Boolean)));
  // Reject an empty rule — it would match every job and spam the seeker.
  if (!input.q && !input.type && !input.location && skills.length === 0) {
    throw new ApiError('BAD_REQUEST', 'Add at least one filter before saving this search.');
  }

  const label =
    input.label?.trim() ||
    [input.q, input.type, input.location].filter(Boolean).join(' · ') ||
    'Saved search';

  // Cap per user so the notify-on-create fan-out stays bounded.
  const count = await prisma.savedSearch.count({ where: { userId: user.id } });
  if (count >= 20) throw new ApiError('CONFLICT', 'You have reached the saved-search limit.');

  const saved = await prisma.savedSearch.create({
    data: {
      userId: user.id,
      label,
      q: input.q || null,
      type: input.type ?? null,
      location: input.location || null,
      skills,
    },
    select: { id: true, label: true },
  });
  return jsonOk(saved, { status: 201 });
});
