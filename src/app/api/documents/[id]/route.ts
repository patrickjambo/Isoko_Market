import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** DELETE /api/documents/[id] — remove one of your own uploaded documents. */
export const DELETE = route(async (_req, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const doc = await prisma.seekerDocument.findUnique({
    where: { id: ctx.params.id },
    select: { userId: true },
  });
  if (!doc) throw new ApiError('NOT_FOUND', 'Document not found.');
  if (doc.userId !== user.id) throw new ApiError('FORBIDDEN', 'This is not your document.');

  await prisma.seekerDocument.delete({ where: { id: ctx.params.id } });
  return jsonOk({ ok: true });
});
