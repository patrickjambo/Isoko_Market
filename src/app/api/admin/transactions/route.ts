import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';

const querySchema = z.object({
  status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']).optional(),
  type: z.enum(['SUBSCRIPTION', 'FEATURED_LISTING', 'JOB_POST', 'ESCROW', 'TOPUP']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const PAGE_SIZE = 25;

/** GET /api/admin/transactions — full ledger + revenue breakdown by type. */
export const GET = adminRoute('transactions.view', async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const { status, type, page } = querySchema.parse(params);

  const where: Prisma.TransactionWhereInput = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [rows, total, byType, today, mtd] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { fullName: true } } },
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({
      by: ['type'],
      where: { status: 'SUCCESS' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { status: 'SUCCESS', createdAt: { gte: startOfDay } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { status: 'SUCCESS', createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
  ]);

  return {
    data: {
      transactions: rows.map((r) => ({
        id: r.id,
        user: r.user.fullName,
        type: r.type,
        amount: r.amount,
        provider: r.provider,
        status: r.status,
        momoRef: r.momoRef,
        createdAt: r.createdAt.toISOString(),
      })),
      revenue: {
        today: today._sum.amount ?? 0,
        mtd: mtd._sum.amount ?? 0,
        byType: byType.map((b) => ({ type: b.type, amount: b._sum.amount ?? 0 })),
      },
    },
    meta: { total, page, pageSize: PAGE_SIZE },
  };
});
