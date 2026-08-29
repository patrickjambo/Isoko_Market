import { route, jsonOk } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { destroySession } from '@/lib/session';

/**
 * POST /api/auth/logout — clears the session cookie AND bumps the user's
 * `sessionVersion`, so the stateless JWT is invalidated server-side too (every
 * outstanding token for this user stops verifying). Without the bump, a captured
 * token would stay valid until its 30-day expiry despite "logging out".
 */
export const POST = route(async () => {
  const user = await getCurrentUser();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
    });
  }
  destroySession();
  return jsonOk({ ok: true });
});
