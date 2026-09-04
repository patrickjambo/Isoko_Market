import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { listingAlertSchema } from '@/lib/validators/listing';

/** GET /api/listing-alerts — the buyer's marketplace "notify me" rules. */
export const GET = route(async () => {
  const user = await requireUser();
  const items = await prisma.savedSearch.findMany({
    where: { userId: user.id, kind: 'LISTING' },
    orderBy: { createdAt: 'desc' },
  });
  return jsonOk({ items });
});

/** POST /api/listing-alerts — save the current marketplace filter as a live alert. */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const input = listingAlertSchema.parse(await req.json().catch(() => ({})));

  const hasCriteria =
    Boolean(input.q || input.categoryId || input.condition || input.location || input.kind) ||
    input.minPrice != null ||
    input.maxPrice != null;
  // Reject an empty rule — it would match every listing and spam the buyer.
  if (!hasCriteria) {
    throw new ApiError('BAD_REQUEST', 'Add at least one filter before saving this search.');
  }

  const label =
    input.label?.trim() ||
    [input.q, input.location].filter(Boolean).join(' · ') ||
    'Saved search';

  // Cap per user (shared with job searches) so the notify-on-create fan-out stays bounded.
  const count = await prisma.savedSearch.count({ where: { userId: user.id, kind: 'LISTING' } });
  if (count >= 20) throw new ApiError('CONFLICT', 'You have reached the saved-search limit.');

  const saved = await prisma.savedSearch.create({
    data: {
      userId: user.id,
      kind: 'LISTING',
      label,
      q: input.q || null,
      categoryId: input.categoryId || null,
      condition: input.condition ?? null,
      listingKind: input.kind ?? null,
      location: input.location || null,
      minPrice: input.minPrice ?? null,
      maxPrice: input.maxPrice ?? null,
    },
    select: { id: true, label: true },
  });
  return jsonOk(saved, { status: 201 });
});
