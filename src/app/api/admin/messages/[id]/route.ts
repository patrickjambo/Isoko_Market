import { ApiError } from '@/lib/api';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';

/**
 * GET /api/admin/messages/[id] — read-only view of a flagged conversation.
 * Every open is written to the audit log for privacy accountability (Section:
 * "log every time an admin opens a conversation").
 */
export const GET = adminRoute(
  'messages.oversight',
  async (_req, ctx: { params: { id: string } }, { admin }) => {
    // Only conversations tied to an open report may be opened.
    const convo = await prisma.conversation.findUnique({
      where: { id: ctx.params.id },
      select: { id: true, listingId: true, jobId: true, participants: { select: { userId: true } } },
    });
    if (!convo) throw new ApiError('NOT_FOUND', 'Conversation not found.');

    const flagged = await prisma.report.findFirst({
      where: {
        status: { in: ['OPEN', 'REVIEWING'] },
        OR: [
          convo.listingId ? { targetType: 'LISTING', targetId: convo.listingId } : { id: '' },
          convo.jobId ? { targetType: 'JOB', targetId: convo.jobId } : { id: '' },
          { targetType: 'USER', targetId: { in: convo.participants.map((p) => p.userId) } },
        ],
      },
      select: { id: true },
    });
    if (!flagged) throw new ApiError('FORBIDDEN', 'This conversation is not under an active report.');

    const messages = await prisma.message.findMany({
      where: { conversationId: ctx.params.id },
      orderBy: { createdAt: 'asc' },
      take: 500,
      include: { sender: { select: { fullName: true } } },
    });

    // Audit the access itself.
    const log = await audit({
      actorId: admin.id,
      action: 'messages.oversight.open',
      targetType: 'CONVERSATION',
      targetId: ctx.params.id,
      reason: `report ${flagged.id}`,
    });

    return {
      data: {
        messages: messages.map((m) => ({
          id: m.id,
          sender: m.sender.fullName,
          body: m.body,
          createdAt: m.createdAt.toISOString(),
        })),
      },
      meta: { audit: log },
    };
  }
);
