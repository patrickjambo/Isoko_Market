import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/notifications/unread — current unread count. Polled by the header
 * bell so the badge updates on its own even on a multi-instance host where the
 * in-memory SSE bus can't reach the viewer (see NotificationBell / usePollRefresh).
 */
export const GET = route(async () => {
  const user = await requireUser();
  const unread = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
  return jsonOk({ unread });
});
