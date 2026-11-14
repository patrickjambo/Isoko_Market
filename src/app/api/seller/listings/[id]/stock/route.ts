import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { publishTopic } from '@/lib/realtime';

const schema = z.object({
  /** New absolute stock quantity. Pass null to remove the stock limit entirely. */
  stockQty: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(0).max(100_000).nullable()
  ),
});

/**
 * PATCH /api/seller/listings/[id]/stock
 * Seller updates the available quantity for a product listing.
 * - Setting stockQty > 0 → updates quantity and re-activates if currently SOLD.
 * - Setting stockQty = 0 → marks SOLD (out of stock).
 * - Setting stockQty = null → removes the stock limit (unlimited).
 */
export const PATCH = route(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const { stockQty } = schema.parse(await req.json().catch(() => ({})));

  const listing = await prisma.listing.findUnique({
    where: { id: ctx.params.id },
    select: { sellerId: true, status: true },
  });
  if (!listing) throw new ApiError('NOT_FOUND', 'Listing not found.');
  if (listing.sellerId !== user.id) throw new ApiError('FORBIDDEN', 'Not your listing.');

  const newStatus =
    stockQty === null
      ? listing.status
      : stockQty === 0
        ? ('SOLD' as const)
        : ('ACTIVE' as const);

  // @ts-ignore — stockQty field added in migration; present after prisma generate
  await prisma.listing.update({
    where: { id: ctx.params.id },
    // @ts-ignore
    data: { stockQty, status: newStatus },
  });

  publishTopic(`listing:${ctx.params.id}`, {
    type: 'entity_update',
    entity: 'listing',
    id: ctx.params.id,
    status: newStatus,
    reason: 'stock_updated',
  });

  return jsonOk({ ok: true, stockQty, status: newStatus });
});
