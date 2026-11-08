'use client';

/**
 * Converts a base64 string to a Uint8Array for VAPID applicationServerKey.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const atobFn = typeof window !== 'undefined' ? window.atob : globalThis.atob;
  const rawData = atobFn(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if the current browser / device supports Web Push notifications.
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get current push notification permission status.
 */
export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Ensure the service worker is registered and ready.
 */
export async function getReadyServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js');
    }
    return reg;
  } catch (error) {
    console.error('Failed to get service worker registration:', error);
    return null;
  }
}

/**
 * Subscribe the current device to Web Push notifications.
 */
export async function subscribeToPushNotifications(): Promise<{
  success: boolean;
  error?: string;
  subscription?: PushSubscription;
}> {
  if (!isPushNotificationSupported()) {
    return {
      success: false,
      error: 'Push notifications are not supported on this browser or device.',
    };
  }

  // 1. Request notification permission from user
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return {
      success: false,
      error: permission === 'denied'
        ? 'Notifications were blocked. Please enable them in your browser/phone settings.'
        : 'Notification permission was dismissed.',
    };
  }

  // 2. Fetch server's public VAPID key
  let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    try {
      const res = await fetch('/api/push/vapid-key');
      const data = await res.json();
      vapidPublicKey = data.publicKey;
    } catch {
      return { success: false, error: 'Failed to retrieve notification credentials from server.' };
    }
  }

  if (!vapidPublicKey) {
    return { success: false, error: 'VAPID public key is missing.' };
  }

  // 3. Ensure service worker registration is active
  const reg = await getReadyServiceWorker();
  if (!reg) {
    return { success: false, error: 'Service worker is not active on this device.' };
  }

  try {
    // 4. Check for existing subscription or create a new one
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as BufferSource,
      });
    }

    // 5. Register with backend
    const subJson = sub.toJSON();
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: subJson.keys,
        userAgent: navigator.userAgent,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return { success: false, error: errorData.error || 'Failed to save subscription on server.' };
    }

    return { success: true, subscription: sub };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Unsubscribe the current device from Web Push notifications.
 */
export async function unsubscribeFromPushNotifications(): Promise<{ success: boolean; error?: string }> {
  if (!isPushNotificationSupported()) return { success: true };

  try {
    const reg = await getReadyServiceWorker();
    if (!reg) return { success: true };

    const sub = await reg.pushManager.getSubscription();
    if (!sub) return { success: true };

    // Remove from backend
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});

    // Unsubscribe in browser
    await sub.unsubscribe();
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Check if this device currently has an active push subscription.
 */
export async function getActivePushSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;
  try {
    const reg = await getReadyServiceWorker();
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}
