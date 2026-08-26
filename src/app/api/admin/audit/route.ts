import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  targetType: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const PAGE_SIZE = 30;

/** GET /api/admin/audit — searchable, paginated immutable audit trail. */
export const GET = adminRoute('audit.view', async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const { q, targetType, page } = querySchema.parse(params);

  const where: Prisma.AuditLogWhereInput = {};
  if (targetType) where.targetType = targetType;
  if (q) where.action = { contains: q, mode: 'insensitive' };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { fullName: true, avatarUrl: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const entries = rows.map((r) => ({
    id: r.id,
    action: r.action,
    actor: r.actor.fullName,
    actorAvatar: r.actor.avatarUrl,
    targetType: r.targetType,
    targetId: r.targetId,
    reason: r.reason,
    before: r.before,
    after: r.after,
    createdAt: r.createdAt.toISOString(),
  }));

  return { data: { entries }, meta: { total, page, pageSize: PAGE_SIZE } };
});
