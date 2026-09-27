import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { effectivePermissions } from '@/lib/permissions';
import { notify } from '@/lib/notifications';
import { emitAdmin } from '@/lib/admin-realtime';
import { ticketPatchSchema } from '@/lib/validators/support';

/**
 * PATCH /api/support/[id] — change a ticket's status/priority. Staff with
 * `support.manage` can set any status + priority; the ticket owner may only
 * CLOSE their own ticket. Resolving/closing notifies the owner.
 */
export const PATCH = route(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const { status, priority } = ticketPatchSchema.parse(await req.json().catch(() => ({})));
  if (!status && !priority) throw new ApiError('BAD_REQUEST', 'Nothing to update.');

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ctx.params.id },
    select: { id: true, userId: true, subject: true },
  });
  if (!ticket) throw new ApiError('NOT_FOUND', 'Ticket not found.');

  const isOwner = ticket.userId === user.id;
  const isStaff = isOwner ? false : (await effectivePermissions(user)).has('support.manage');
  if (!isOwner && !isStaff) throw new ApiError('FORBIDDEN', 'You cannot manage this ticket.');

  // The owner (when not staff) may only close their own ticket.
  if (isOwner && !isStaff && (priority || (status && status !== 'CLOSED'))) {
    throw new ApiError('FORBIDDEN', 'You can only close your own ticket.');
  }

  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      ...(status ? { status } : {}),
      ...(priority && isStaff ? { priority } : {}),
    },
  });

  if (isStaff && (status === 'RESOLVED' || status === 'CLOSED')) {
    await notify({
      userId: ticket.userId,
      type: 'SYSTEM',
      title: status === 'RESOLVED' ? 'Your support ticket was resolved' : 'Your support ticket was closed',
      body: ticket.subject,
      href: `/support/${ticket.id}`,
    });
  }
  await emitAdmin('support.updated', `Ticket ${status ?? 'updated'}: ${ticket.subject}`);

  return jsonOk({ ok: true });
});
