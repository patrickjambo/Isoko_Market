import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateProfileSchema } from '@/lib/validators/misc';
import { toSessionUser } from '@/lib/serialize';
import { notify } from '@/lib/notifications';
import { publishTopic } from '@/lib/realtime';

/** PATCH /api/profile — update the current user's editable profile fields. */
export const PATCH = route(async (req: NextRequest) => {
  const user = await requireUser();
  const input = updateProfileSchema.parse(await req.json().catch(() => ({})));

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: input,
  });

  // If the seller just added a payout number, unblock buyers already waiting on
  // it: snapshot it onto their pending orders and tell them they can now pay.
  if (input.paymentNumber && updated.paymentNumber) {
    const waiting = await prisma.order.findMany({
      where: { sellerId: user.id, status: 'PENDING_PAYMENT', sellerPayoutNumber: null },
      select: { id: true, buyerId: true, listing: { select: { title: true } } },
    });
    if (waiting.length > 0) {
      const method = updated.paymentProvider === 'airtel_money' ? 'manual_airtel' : 'manual_momo';
      await prisma.order.updateMany({
        where: { id: { in: waiting.map((o) => o.id) } },
        data: { sellerPayoutNumber: updated.paymentNumber, paymentMethod: method },
      });
      await Promise.all(
        waiting.map(async (o) => {
          await notify({
            userId: o.buyerId,
            type: 'PAYMENT',
            title: 'Seller added payment details',
            body: `You can now pay for "${o.listing.title}". Open the order to see the number.`,
            href: `/orders/${o.id}`,
            payload: { orderId: o.id },
          });
          // Live-refresh the buyer's open order page (SSE + poll fallback).
          publishTopic(`order:${o.id}`, {
            type: 'entity_update',
            entity: 'order',
            id: o.id,
            status: 'PENDING_PAYMENT',
            reason: 'payout_added',
          });
        })
      );
    }
  }

  return jsonOk({ user: toSessionUser(updated) });
});
