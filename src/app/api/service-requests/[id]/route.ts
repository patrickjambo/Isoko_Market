import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notify } from '@/lib/notifications';
import { publish } from '@/lib/realtime';
import { updateServiceRequestSchema } from '@/lib/validators/service-request';

/**
 * PATCH /api/service-requests/[id] — move a request along its lifecycle. The
 * provider may CONFIRM / DECLINE / mark COMPLETED; the requester may CANCEL. The
 * other party is notified in real time.
 */
export const PATCH = route(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const { status } = updateServiceRequestSchema.parse(await req.json().catch(() => ({})));

  const sr = await prisma.serviceRequest.findUnique({
    where: { id: ctx.params.id },
    select: {
      id: true,
      requesterId: true,
      providerId: true,
      status: true,
      listing: { select: { title: true } },
    },
  });
  if (!sr) throw new ApiError('NOT_FOUND', 'Request not found.');

  const isProvider = sr.providerId === user.id;
  const isRequester = sr.requesterId === user.id;
  if (!isProvider && !isRequester) throw new ApiError('FORBIDDEN', 'Not your request.');

  // Provider accepts/declines/completes; requester can only withdraw.
  const allowed = isProvider ? ['CONFIRMED', 'DECLINED', 'COMPLETED'] : ['CANCELLED'];
  if (!allowed.includes(status)) {
    throw new ApiError('FORBIDDEN', 'You cannot set that status.');
  }
  // Terminal states can't change again.
  if (['DECLINED', 'COMPLETED', 'CANCELLED'].includes(sr.status)) {
    throw new ApiError('CONFLICT', 'This request is already closed.');
  }

  await prisma.serviceRequest.update({ where: { id: sr.id }, data: { status } });

  const otherId = isProvider ? sr.requesterId : sr.providerId;
  await notify({
    userId: otherId,
    type: 'SYSTEM',
    title: `Service request ${status.toLowerCase()}`,
    body: `"${sr.listing.title}" — ${status.toLowerCase()}`,
    href: '/dashboard/requests',
    payload: { serviceRequestId: sr.id },
  });
  publish(otherId, { type: 'entity_update', entity: 'serviceRequest', id: sr.id, status });

  return jsonOk({ ok: true, status });
});
