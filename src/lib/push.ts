import 'server-only';
import webpush from 'web-push';
import type { NotificationType } from '@prisma/client';
import { prisma } from './prisma';
import { env } from './env';

// Configure Web Push with VAPID details (RFC 8292)
webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
);

export type PushPayload = {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  url?: string;
  type?: NotificationType | 'TEST';
  data?: Record<string, unknown>;
};

/**
 * Determine whether a notification type is enabled by the user's preferences.
 */
function isPushAllowedByType(
  type: NotificationType | 'TEST' | undefined,
  prefs: {
    pushEnabled: boolean;
    notifyMessages: boolean;
    notifyOrders: boolean;
    notifyListings: boolean;
    notifyJobs: boolean;
    notifySystem: boolean;
  } | null
): boolean {
  if (!prefs) return true; // Default is true for all
  if (!prefs.pushEnabled) return false; // Master switch

  if (!type || type === 'TEST') return true;

  switch (type) {
    case 'MESSAGE':
      return prefs.notifyMessages;
    case 'PAYMENT':
      return prefs.notifyOrders;
    case 'FAVORITE':
    case 'LISTING_SOLD':
      return prefs.notifyListings;
    case 'APPLICATION_UPDATE':
      return prefs.notifyJobs;
    case 'VERIFICATION_APPROVED':
    case 'VERIFICATION_REJECTED':
    case 'REVIEW_RECEIVED':
    case 'SYSTEM':
    default:
      return prefs.notifySystem;
  }
}

/**
 * Send a web push notification to all active devices registered to a user.
 * Implements delivery retry with backoff, offline device handling, and automatic
 * pruning of expired/unsubscribed endpoints (404/410 Gone).
 */
export async function sendPushNotification(params: {
  userId: string;
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  image?: string;
  type?: NotificationType | 'TEST';
}): Promise<{ sent: number; failed: number; pruned: number }> {
  // 1. Check user notification preferences
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: params.userId },
  });

  if (!isPushAllowedByType(params.type, prefs)) {
    return { sent: 0, failed: 0, pruned: 0 };
  }

  // 2. Query all active push subscriptions for this user
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: params.userId },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, pruned: 0 };
  }

  // 3. Prepare standard Web Push JSON payload
  const payloadData: PushPayload = {
    title: params.title.startsWith('Zenova') ? params.title : `Zenova — ${params.title}`,
    body: params.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    image: params.image,
    tag: params.tag || `notif-${Date.now()}`,
    url: params.url || '/',
    type: params.type,
    data: {
      url: params.url || '/',
      type: params.type,
      timestamp: Date.now(),
    },
  };

  const payloadString = JSON.stringify(payloadData);

  let sent = 0;
  let failed = 0;
  let pruned = 0;

  // 4. Send to all devices with retry mechanism and cleanup
  const pushPromises = subscriptions.map(async (sub) => {
    const pushSub: webpush.PushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    let attempt = 0;
    const maxAttempts = 2;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        await webpush.sendNotification(pushSub, payloadString, {
          TTL: 86400, // 24 hours delivery window for offline phones
          urgency: 'high',
        });
        sent++;
        return;
      } catch (err: unknown) {
        const error = err as { statusCode?: number; message?: string };
        const status = error.statusCode;

        // 404 Not Found or 410 Gone means the subscription is permanently expired/revoked
        if (status === 404 || status === 410) {
          try {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
            pruned++;
          } catch {
            /* already deleted */
          }
          return;
        }

        // Rate limit (429) or transient server errors (500, 502, 503): retry with backoff
        if (attempt < maxAttempts && (status === 429 || (status && status >= 500))) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
          continue;
        }

        failed++;
        return;
      }
    }
  });

  await Promise.allSettled(pushPromises);
  return { sent, failed, pruned };
}

/**
 * Send a test push notification to verify lock screen delivery on this device.
 */
export async function sendTestPush(userId: string): Promise<{ sent: number; failed: number }> {
  const result = await sendPushNotification({
    userId,
    title: 'Notifications Working! 🎉',
    body: 'You will now receive instant alerts for messages, orders, and listings even when Zenova is closed.',
    url: '/profile/settings',
    tag: 'test-push',
    type: 'TEST',
  });
  return { sent: result.sent, failed: result.failed };
}
