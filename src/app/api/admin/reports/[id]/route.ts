import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';

const schema = z.object({
  status: z.enum(['REVIEWING', 'RESOLVED', 'DISMISSED']),
  reason: z.string().trim().max(500).optional(),
});

/** PATCH /api/admin/reports/[id] — moderator resolves/dismisses a report. */
export const PATCH = adminRoute(
  'moderation.resolve',
  async (req, ctx: { params: { id: string } }, { admin }) => {
    const { status, reason } = schema.parse(await req.json().catch(() => ({})));

    const report = await prisma.report.findUnique({ where: { id: ctx.params.id } });
    if (!report) throw new ApiError('NOT_FOUND', 'Report not found.');

    await prisma.report.update({ where: { id: ctx.params.id }, data: { status } });

    const log = await audit({
      actorId: admin.id,
      action: 'moderation.resolve',
      targetType: 'REPORT',
      targetId: report.id,
      reason,
      before: { status: report.status },
      after: { status },
    });

    return { data: { status }, meta: { audit: log } };
  }
);
