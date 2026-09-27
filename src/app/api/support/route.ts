import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emitAdmin } from '@/lib/admin-realtime';
import { createTicketSchema } from '@/lib/validators/support';

/**
 * POST /api/support — open a new help-desk ticket. Creates the ticket plus its
 * first message (from the user) and pings the admin support queue live.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const { subject, category, message } = createTicketSchema.parse(
    await req.json().catch(() => ({}))
  );

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: user.id,
      subject,
      category,
      status: 'OPEN',
      messages: { create: { senderId: user.id, body: message, fromStaff: false } },
    },
    select: { id: true },
  });

  await emitAdmin('support.created', `New support ticket: ${subject}`);

  return jsonOk({ id: ticket.id });
});
