import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** GET /api/cv — the user's CV library (id, name, updatedAt), newest first. */
export const GET = route(async () => {
  const user = await requireUser();
  const cvs = await prisma.cV.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, updatedAt: true },
  });
  return jsonOk({ cvs });
});

/** POST /api/cv — create a new, empty named CV. Returns its id. */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const body = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name =
    typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : 'My CV';

  const cv = await prisma.cV.create({
    data: { userId: user.id, name, structuredData: {} },
    select: { id: true },
  });
  return jsonOk({ id: cv.id }, { status: 201 });
});
