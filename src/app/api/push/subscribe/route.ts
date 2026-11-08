import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid subscription payload', details: parsed.error.issues }, { status: 400 });
  }

  const { endpoint, keys, userAgent } = parsed.data;
  const ua = req.headers.get('user-agent') || userAgent || null;

  // Upsert subscription tied to this user and device endpoint
  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: ua,
    },
    update: {
      userId: user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: ua,
    },
  });

  // Ensure default notification preferences exist for this user
  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      pushEnabled: true,
      notifyMessages: true,
      notifyOrders: true,
      notifyListings: true,
      notifyJobs: true,
      notifySystem: true,
    },
    update: {
      pushEnabled: true,
    },
  });

  return NextResponse.json({
    success: true,
    subscriptionId: subscription.id,
  });
}
