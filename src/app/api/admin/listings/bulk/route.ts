import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';

const schema = z.object({
  action: z.enum(['remove', 'feature', 'unfeature']),
  ids: z.array(z.string().cuid()).min(1).max(100),
  reason: z.string().trim().max(300).optional(),
});

const PERM: Record<string, string> = {
  remove: 'listings.remove',
  feature: 'listings.feature',
  unfeature: 'listings.feature',
};

/** POST /api/admin/listings/bulk — bulk remove / feature / unfeature. */
export const POST = adminRoute(null, async (req, _ctx, { admin, permissions }) => {
  const { action, ids, reason } = schema.parse(await req.json().catch(() => ({})));
  const perm = PERM[action]!;
  if (!permissions.has(perm)) throw new ApiError('FORBIDDEN', `Missing permission: ${perm}`);

  const data =
    action === 'remove'
      ? { status: 'REMOVED' as const }
      : action === 'feature'
        ? { isFeatured: true, featuredUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
        : { isFeatured: false, featuredUntil: null };

  const result = await prisma.listing.updateMany({ where: { id: { in: ids } }, data });

  const log = await audit({
    actorId: admin.id,
    action: `listings.${action}`,
    targetType: 'LISTING',
    targetId: ids.join(','),
    reason,
    after: { count: result.count },
  });

  return { data: { count: result.count }, meta: { audit: log } };
});
