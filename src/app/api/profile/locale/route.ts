import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { route, jsonOk } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const schema = z.object({ locale: z.enum(['rw', 'en', 'fr']) });

/** Persist the user's language choice so it follows them across devices. */
export const POST = route(async (req: NextRequest) => {
  const { locale } = schema.parse(await req.json().catch(() => ({})));
  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { locale } });
  }
  return jsonOk({ ok: true });
});
