import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/messages — conversations that are FLAGGED (linked to an open
 * report) only. This is never blanket surveillance: only conversations tied to
 * a reported listing/job/user surface here, and opening one is audit-logged.
 */
export const GET = adminRoute('messages.oversight', async () => {
  const openReports = await prisma.report.findMany({
    where: { status: { in: ['OPEN', 'REVIEWING'] } },
    select: { targetType: true, targetId: true },
  });

  const listingIds = openReports.filter((r) => r.targetType === 'LISTING').map((r) => r.targetId);
  const jobIds = openReports.filter((r) => r.targetType === 'JOB').map((r) => r.targetId);
  const userIds = openReports.filter((r) => r.targetType === 'USER').map((r) => r.targetId);

  if (!listingIds.length && !jobIds.length && !userIds.length) {
    return { data: { conversations: [] }, meta: { total: 0 } };
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { listingId: { in: listingIds } },
        { jobId: { in: jobIds } },
        { participants: { some: { userId: { in: userIds } } } },
      ],
    },
    orderBy: { lastMessageAt: 'desc' },
    take: 50,
    include: {
      listing: { select: { title: true } },
      job: { select: { title: true } },
      participants: { include: { user: { select: { fullName: true } } } },
      _count: { select: { messages: true } },
    },
  });

  return {
    data: {
      conversations: conversations.map((c) => ({
        id: c.id,
        about: c.listing?.title ?? c.job?.title ?? null,
        participants: c.participants.map((p) => p.user.fullName),
        messageCount: c._count.messages,
        lastMessageAt: c.lastMessageAt.toISOString(),
      })),
    },
    meta: { total: conversations.length },
  };
});
