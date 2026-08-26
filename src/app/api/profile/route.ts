import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateProfileSchema } from '@/lib/validators/misc';
import { toSessionUser } from '@/lib/serialize';

/** PATCH /api/profile — update the current user's editable profile fields. */
export const PATCH = route(async (req: NextRequest) => {
  const user = await requireUser();
  const input = updateProfileSchema.parse(await req.json().catch(() => ({})));

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: input,
  });

  return jsonOk({ user: toSessionUser(updated) });
});
