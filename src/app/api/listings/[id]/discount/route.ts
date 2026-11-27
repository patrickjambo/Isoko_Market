import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const setSchema = z.object({
  discountPrice: z.number().positive('Discount price must be positive'),
  discountEndsAt: z.string().datetime().nullable().optional(),
});

const clearSchema = z.object({ clear: z.literal(true) });

/**
 * POST /api/listings/[id]/discount
 * Sets or clears a discount on a listing (seller only).
 */
export const POST = route(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();

  const listing = await prisma.listing.findUnique({
    where: { id: ctx.params.id },
    select: { id: true, sellerId: true, price: true, status: true },
  });
  if (!listing) throw new ApiError('NOT_FOUND', 'Listing not found.');
  if (listing.sellerId !== user.id) throw new ApiError('FORBIDDEN', 'Not your listing.');
  if (listing.status === 'REMOVED')
    throw new ApiError('BAD_REQUEST', 'Cannot discount a removed listing.');

  const body = await req.json() as unknown;

  // Clear the discount
  const clearParsed = clearSchema.safeParse(body);
  if (clearParsed.success) {
    await prisma.listing.update({
      where: { id: listing.id },
      data: { discountPrice: null, discountEndsAt: null },
    });
    return jsonOk({ cleared: true });
  }

  // Set a discount
  const parsed = setSchema.safeParse(body);
  if (!parsed.success)
    throw new ApiError('BAD_REQUEST', parsed.error.errors[0]?.message ?? 'Invalid discount data.');
  const { discountPrice, discountEndsAt } = parsed.data;

  if (discountPrice >= listing.price)
    throw new ApiError('BAD_REQUEST', 'Discount price must be less than the regular price.');
  if (discountPrice <= 0)
    throw new ApiError('BAD_REQUEST', 'Discount price must be greater than zero.');

  await prisma.listing.update({
    where: { id: listing.id },
    data: {
      discountPrice,
      discountEndsAt: discountEndsAt ? new Date(discountEndsAt) : null,
    },
  });

  return jsonOk({ set: true, discountPrice, discountEndsAt: discountEndsAt ?? null });
});
