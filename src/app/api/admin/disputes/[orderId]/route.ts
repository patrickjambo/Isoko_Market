import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ApiError } from '@/lib/api';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications';
import { emitAdmin } from '@/lib/admin-realtime';

const schema = z.object({
  resolution: z.enum(['BUYER', 'SELLER']),
  note: z.string().trim().max(1000).optional(),
});

/**
 * PATCH /api/admin/disputes/[orderId] — an admin arbitrates a disputed order.
 * Favour the BUYER → the order is cancelled and the listing relisted; favour the
 * SELLER → the order is completed. The linked report is resolved, both parties
 * are notified with the decision, and the action is audited. Money moved off
 * platform (manual P2P), so this records the outcome rather than moving funds.
 */
export const PATCH = adminRoute(
  'moderation.resolve',
  async (req, ctx: { params: { orderId: string } }, { admin }) => {
    const { resolution, note } = schema.parse(await req.json().catch(() => ({})));

    const order = await prisma.order.findUnique({
      where: { id: ctx.params.orderId },
      select: {
        id: true,
        status: true,
        buyerId: true,
        sellerId: true,
        listingId: true,
        disputeReportId: true,
        listing: { select: { title: true } },
      },
    });
    if (!order) throw new ApiError('NOT_FOUND', 'Order not found.');
    if (order.status !== 'DISPUTED') throw new ApiError('BAD_REQUEST', 'This order is not under dispute.');

    const forBuyer = resolution === 'BUYER';
    const newStatus = forBuyer ? 'CANCELLED' : 'COMPLETED';

    const tx: Prisma.PrismaPromise<unknown>[] = [
      prisma.order.update({ where: { id: order.id }, data: { status: newStatus } }),
    ];
    // Buyer's favour → the sale falls through, so put the item back on the market.
    if (forBuyer) {
      tx.push(prisma.listing.update({ where: { id: order.listingId }, data: { status: 'ACTIVE' } }));
    }
    if (order.disputeReportId) {
      tx.push(prisma.report.update({ where: { id: order.disputeReportId }, data: { status: 'RESOLVED' } }));
    }
    await prisma.$transaction(tx);

    const log = await audit({
      actorId: admin.id,
      action: 'dispute.resolve',
      targetType: 'ORDER',
      targetId: order.id,
      reason: note,
      before: { status: 'DISPUTED' },
      after: { status: newStatus, resolution },
    });

    // Notify both sides with the outcome.
    const title = 'Dispute resolved';
    const body = note
      ? `"${order.listing.title}": ${note}`
      : `A decision was made on "${order.listing.title}".`;
    await Promise.all([
      notify({ userId: order.buyerId, type: 'SYSTEM', title, body, href: `/orders/${order.id}` }),
      notify({ userId: order.sellerId, type: 'SYSTEM', title, body, href: `/orders/${order.id}` }),
    ]);

    await emitAdmin('report.created', `Dispute resolved: ${order.listing.title}`);

    return { data: { status: newStatus }, meta: { audit: log } };
  }
);
