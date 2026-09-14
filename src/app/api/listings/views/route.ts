import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/listings/views — clear the signed-in user's "recently viewed"
 * history (the home-page strip). Removes their ListingView rows.
 */
export const DELETE = route(async () => {
  const user = await requireUser();
  await prisma.listingView.deleteMany({ where: { userId: user.id } });
  return jsonOk({ ok: true });
});
