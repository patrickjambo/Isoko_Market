import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cvDataSchema } from '@/lib/validators/cv';

/** GET /api/cv — the current user's CV data (empty skeleton if none yet). */
export const GET = route(async () => {
  const user = await requireUser();
  const cv = await prisma.cV.findUnique({ where: { userId: user.id } });
  return jsonOk({ data: cv?.structuredData ?? null, updatedAt: cv?.updatedAt ?? null });
});

/** PUT /api/cv — create or update the CV (guided builder autosave/save). */
export const PUT = route(async (req: NextRequest) => {
  const user = await requireUser();
  const data = cvDataSchema.parse(await req.json().catch(() => ({})));

  // Mirror the selected division to the queryable column (validated against the
  // seeded AdminDivision table); the display label lives in structuredData.
  let locationId: string | null = null;
  if (data.location?.id) {
    const div = await prisma.adminDivision.findUnique({ where: { id: data.location.id }, select: { id: true } });
    locationId = div?.id ?? null;
  }

  const cv = await prisma.cV.upsert({
    where: { userId: user.id },
    create: { userId: user.id, structuredData: data, locationId },
    update: { structuredData: data, locationId },
    select: { id: true, updatedAt: true },
  });

  return jsonOk({ id: cv.id, updatedAt: cv.updatedAt });
});
