import 'server-only';
import type { NotificationType, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { publish, isOnline } from './realtime';
import { sms } from './sms';

// High-signal notifications worth an SMS when the user is offline.
const SMS_FALLBACK_TYPES: NotificationType[] = [
  'MESSAGE',
  'APPLICATION_UPDATE',
  'VERIFICATION_APPROVED',
  'VERIFICATION_REJECTED',
  'LISTING_SOLD',
];

/**
 * Create a persisted notification AND push it live over the realtime bus, so
 * the recipient's badge/notification center updates without a page refresh
 * (Section 6.5 / 9.1). If the recipient has no open realtime connection, fall
 * back to SMS for high-signal events — honouring the low-connectivity
 * commitment (Section 6.5).
 */
export async function notify(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  payload?: Prisma.InputJsonValue;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      href: params.href,
      payload: params.payload,
    },
  });

  publish(params.userId, {
    type: 'notification',
    notification: {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      href: notification.href,
      createdAt: notification.createdAt.toISOString(),
    },
  });

  // SMS fallback for offline users (best-effort, never blocks the caller).
  if (!isOnline(params.userId) && SMS_FALLBACK_TYPES.includes(params.type)) {
    void sendSmsFallback(params.userId, params.title, params.body);
  }

  return notification;
}

async function sendSmsFallback(userId: string, title: string, body?: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    if (!user) return;
    const text = body ? `Isoko: ${title} — ${body}` : `Isoko: ${title}`;
    await sms.send(user.phone, text.slice(0, 300));
  } catch {
    /* fallback is best-effort */
  }
}
