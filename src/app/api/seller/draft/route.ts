import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { draftDataSchema } from '@/lib/validators/listing';

/** GET /api/seller/draft — the seller's in-progress Add Product draft, if any. */
export const GET = route(async () => {
  const user = await requireUser();
  const draft = await prisma.listingDraft.findUnique({ where: { sellerId: user.id } });
  return jsonOk({ draft: draft ? { data: draft.data, step: draft.step } : null });
});

const putSchema = z.object({
  data: draftDataSchema,
  step: z.coerce.number().int().min(1).max(6).default(1),
});

/** PUT /api/seller/draft — autosave draft at every step (Section 3). */
export const PUT = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { data, step } = putSchema.parse(await req.json().catch(() => ({})));
  await prisma.listingDraft.upsert({
    where: { sellerId: user.id },
    create: { sellerId: user.id, data, step },
    update: { data, step },
  });
  return jsonOk({ ok: true });
});

/** DELETE /api/seller/draft — discard the draft. */
export const DELETE = route(async () => {
  const user = await requireUser();
  await prisma.listingDraft.deleteMany({ where: { sellerId: user.id } });
  return jsonOk({ ok: true });
});
