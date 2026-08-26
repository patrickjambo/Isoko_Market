import { z } from 'zod';
import { userRoute } from '@/lib/user-route';
import { createOrder, getOrdersForUser } from '@/lib/orders';

/** GET /api/orders — the user's orders (as buyer and seller). */
export const GET = userRoute(async (_req, _ctx, { user }) => {
  const orders = await getOrdersForUser(user.id);
  return { data: { orders }, meta: { total: orders.length } };
});

const createSchema = z.object({
  listingId: z.string().cuid(),
  deliveryMethod: z.enum(['pickup', 'delivery']).optional(),
});

/** POST /api/orders — "Buy Now" checkout (escrow). */
export const POST = userRoute(async (req, _ctx, { user }) => {
  const input = createSchema.parse(await req.json().catch(() => ({})));
  const order = await createOrder({
    buyerId: user.id,
    buyerPhone: user.phone,
    buyerName: user.fullName,
    listingId: input.listingId,
    deliveryMethod: input.deliveryMethod,
  });
  return { data: { orderId: order.id } };
});
