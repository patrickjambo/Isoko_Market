import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';

const querySchema = z.object({
  status: z.enum(['ACTIVE', 'SOLD', 'REMOVED']).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const PAGE_SIZE = 20;

/** GET /api/admin/listings — all listings with filters, for moderation. */
export const GET = adminRoute('listings.view', async (req) => {
  const { status, q, page } = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams));

  const where: Prisma.ListingWhereInput = {};
  if (status) where.status = status;
  if (q) where.title = { contains: q, mode: 'insensitive' };

  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        price: true,
        status: true,
        isFeatured: true,
        createdAt: true,
        seller: { select: { fullName: true } },
      },
    }),
    prisma.listing.count({ where }),
  ]);

  return {
    data: {
      listings: rows.map((l) => ({
        id: l.id,
        title: l.title,
        price: l.price,
        status: l.status,
        isFeatured: l.isFeatured,
        seller: l.seller.fullName,
        createdAt: l.createdAt.toISOString(),
      })),
    },
    meta: { total, page, pageSize: PAGE_SIZE },
  };
});
