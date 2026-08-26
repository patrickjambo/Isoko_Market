import { ApiError } from '@/lib/api';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { partnerSchema } from '@/lib/validators/misc';
import { audit } from '@/lib/audit';

/** PATCH /api/admin/partners/[id] — edit a partner. */
export const PATCH = adminRoute(
  'partners.manage',
  async (req, ctx: { params: { id: string } }, { admin }) => {
    const input = partnerSchema.partial().parse(await req.json().catch(() => ({})));
    const partner = await prisma.partner
      .update({ where: { id: ctx.params.id }, data: input })
      .catch(() => null);
    if (!partner) throw new ApiError('NOT_FOUND', 'Partner not found.');
    const log = await audit({
      actorId: admin.id,
      action: 'partners.manage',
      targetType: 'PARTNER',
      targetId: partner.id,
    });
    return { data: { partner }, meta: { audit: log } };
  }
);

/** DELETE /api/admin/partners/[id] — remove a partner. */
export const DELETE = adminRoute(
  'partners.manage',
  async (_req, ctx: { params: { id: string } }, { admin }) => {
    const partner = await prisma.partner.findUnique({ where: { id: ctx.params.id } });
    await prisma.partner.delete({ where: { id: ctx.params.id } }).catch(() => null);
    const log = await audit({
      actorId: admin.id,
      action: 'partners.remove',
      targetType: 'PARTNER',
      targetId: ctx.params.id,
      before: partner ? { name: partner.name } : undefined,
    });
    return { data: { ok: true }, meta: { audit: log } };
  }
);
