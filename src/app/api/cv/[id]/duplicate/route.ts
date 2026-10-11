import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** POST /api/cv/[id]/duplicate — clone a CV into a new "Copy of …" library entry. */
export const POST = route(async (_req, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const src = await prisma.cV.findFirst({
    where: { id: ctx.params.id, userId: user.id },
    select: { name: true, structuredData: true, locationId: true },
  });
  if (!src) throw new ApiError('NOT_FOUND', 'CV not found.');

  const copy = await prisma.cV.create({
    data: {
      userId: user.id,
      name: `Copy of ${src.name}`.slice(0, 80),
      structuredData: src.structuredData ?? {},
      locationId: src.locationId,
    },
    select: { id: true },
  });
  return jsonOk({ id: copy.id }, { status: 201 });
});
