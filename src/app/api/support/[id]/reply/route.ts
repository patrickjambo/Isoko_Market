import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { effectivePermissions } from '@/lib/permissions';
import { notify } from '@/lib/notifications';
import { emitAdmin } from '@/lib/admin-realtime';
import { replySchema } from '@/lib/validators/support';

/**
 * POST /api/support/[id]/reply — add a message to a ticket. The owner and any
 * staff member with `support.reply` may post; a staff reply flips the ticket to
 * PENDING (awaiting the user) and notifies them, a user reply flips it back to
 * OPEN and pings the admin queue. Closed tickets can't receive replies.
 */
export const POST = route(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const { body } = replySchema.parse(await req.json().catch(() => ({})));

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ctx.params.id },
    select: { id: true, userId: true, status: true, subject: true },
  });
  if (!ticket) throw new ApiError('NOT_FOUND', 'Ticket not found.');

  const isOwner = ticket.userId === user.id;
  let isStaff = false;
  if (!isOwner) {
    const perms = await effectivePermissions(user);
    isStaff = perms.has('support.reply');
    if (!isStaff) throw new ApiError('FORBIDDEN', 'You cannot reply to this ticket.');
  }
  if (ticket.status === 'CLOSED') {
    throw new ApiError('BAD_REQUEST', 'This ticket is closed. Open a new one if you still need help.');
  }

  await prisma.$transaction([
    prisma.supportMessage.create({
      data: { ticketId: ticket.id, senderId: user.id, body, fromStaff: isStaff },
    }),
    prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: isStaff ? 'PENDING' : 'OPEN', lastReplyAt: new Date() },
    }),
  ]);

  if (isStaff) {
    await notify({
      userId: ticket.userId,
      type: 'SYSTEM',
      title: 'Support replied to your ticket',
      body: ticket.subject,
      href: `/support/${ticket.id}`,
    });
  } else {
    await emitAdmin('support.reply', `New reply on ticket: ${ticket.subject}`);
  }

  return jsonOk({ ok: true });
});
