import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { authorize } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

/** DELETE /api/saved-searches/[id] — remove one of the seeker's own rules. */
export const DELETE = route(async (_req, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const existing = await prisma.savedSearch.findUnique({
    where: { id: ctx.params.id },
    select: { userId: true },
  });
  if (!existing) throw new ApiError('NOT_FOUND', 'Saved search not found.');
  await authorize(user, 'savedSearch:delete', existing);

  await prisma.savedSearch.delete({ where: { id: ctx.params.id } });
  return jsonOk({ ok: true });
});
