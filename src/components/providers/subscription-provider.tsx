'use client';

import * as React from 'react';
import { useRouter } from '@/i18n/routing';
import type { SubscriptionSettings, RealtimeEvent } from '@/lib/realtime';

export type { SubscriptionSettings };

const BROADCAST_CHANNEL_NAME = 'zenova:subscription-settings';
const WINDOW_EVENT_NAME = 'zenova:subscription-settings-updated';

/**
 * Dispatch an immediate subscription settings change across all browser tabs and in-memory listeners.
 * Used by admin forms so UI updates in <1ms without waiting for network round-trips.
 */
export function broadcastSubscriptionSettingsChange(settings: SubscriptionSettings): void {
  if (typeof window === 'undefined') return;

  // 1. Cross-tab sync via BroadcastChannel
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage({ settings });
      channel.close();
    }
  } catch {
    /* BroadcastChannel unsupported or blocked */
  }

  // 2. Same-window custom event
  try {
    window.dispatchEvent(new CustomEvent(WINDOW_EVENT_NAME, { detail: settings }));
  } catch {
    /* ignore */
  }
}

const DEFAULT_SETTINGS: SubscriptionSettings = {
  subscriptionEnabled: false,
  subscriptionMonthlyPrice: 5000,
  subscriptionAnnualPrice: 50000,
  subscriptionMomoNumber: '',
  subscriptionMomoKind: 'PHONE',
  subscriptionRequireOnPublish: false,
  subscriptionAutoExpireMonths: 3,
  subscriptionAutoExpireListings: 0,
};

const SubscriptionContext = React.createContext<SubscriptionSettings>(DEFAULT_SETTINGS);

export function SubscriptionProvider({
  initialSettings,
  children,
}: {
  initialSettings?: SubscriptionSettings;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [settings, setSettings] = React.useState<SubscriptionSettings>(
    initialSettings ?? DEFAULT_SETTINGS
  );
  const settingsRef = React.useRef<SubscriptionSettings>(settings);
  settingsRef.current = settings;

  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced server component refresh so Server Components update seamlessly
  const triggerServerRefresh = React.useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      router.refresh();
    }, 250);
  }, [router]);

  const applySettings = React.useCallback(
    (next: SubscriptionSettings) => {
      const prev = settingsRef.current;
      const changed =
        prev.subscriptionEnabled !== next.subscriptionEnabled ||
        prev.subscriptionMonthlyPrice !== next.subscriptionMonthlyPrice ||
        prev.subscriptionAnnualPrice !== next.subscriptionAnnualPrice ||
        prev.subscriptionMomoNumber !== next.subscriptionMomoNumber ||
        prev.subscriptionMomoKind !== next.subscriptionMomoKind ||
        prev.subscriptionRequireOnPublish !== next.subscriptionRequireOnPublish ||
        prev.subscriptionAutoExpireMonths !== next.subscriptionAutoExpireMonths ||
        prev.subscriptionAutoExpireListings !== next.subscriptionAutoExpireListings;

      if (changed) {
        setSettings(next);
        triggerServerRefresh();
      }
    },
    [triggerServerRefresh]
  );

  // Sync when initialSettings prop changes from server re-render
  React.useEffect(() => {
    if (initialSettings) {
      applySettings(initialSettings);
    }
  }, [initialSettings, applySettings]);

  // 1. Cross-tab sync via BroadcastChannel
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<{ settings?: SubscriptionSettings }>) => {
        if (event.data?.settings) {
          applySettings(event.data.settings);
        }
      };
      return () => channel.close();
    } catch {
      return;
    }
  }, [applySettings]);

  // 2. Local window event listener
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleEvent = (e: Event) => {
      const detail = (e as CustomEvent<SubscriptionSettings>).detail;
      if (detail) applySettings(detail);
    };
    window.addEventListener(WINDOW_EVENT_NAME, handleEvent);
    return () => window.removeEventListener(WINDOW_EVENT_NAME, handleEvent);
  }, [applySettings]);

  // 3. SSE stream listener (/api/realtime) — delivers real-time updates to all connected clients
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let source: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      source = new EventSource('/api/realtime');

      source.onmessage = (e) => {
        if (!e.data) return;
        try {
          const parsed = JSON.parse(e.data) as RealtimeEvent;
          if (parsed.type === 'subscription_settings_updated' && parsed.settings) {
            applySettings(parsed.settings);
          }
        } catch {
          /* ignore ping comments or non-JSON payloads */
        }
      };

      source.onerror = () => {
        if (source?.readyState === EventSource.CLOSED) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      };
    };

    if (document.readyState === 'complete') {
      connect();
    } else {
      window.addEventListener('load', connect, { once: true });
    }

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      source?.close();
    };
  }, [applySettings]);

  // 4. Tab visibility / focus sync & polling fallback (cross-device & serverless realtime sync)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncSettings = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/subscription-settings', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json?.data) {
            applySettings(json.data);
          }
        }
      } catch {
        /* ignore network errors on resume */
      }
    };

    // Immediate check on focus/visibility change
    document.addEventListener('visibilitychange', syncSettings);
    window.addEventListener('focus', syncSettings);

    // Active polling every 3 seconds while visible to guarantee instant cross-device updates
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncSettings();
      }
    }, 3000);

    return () => {
      document.removeEventListener('visibilitychange', syncSettings);
      window.removeEventListener('focus', syncSettings);
      clearInterval(timer);
    };
  }, [applySettings]);

  return (
    <SubscriptionContext.Provider value={settings}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/**
 * Access the reactive subscription settings state anywhere in client components.
 */
export function useSubscriptionSettings(): SubscriptionSettings {
  return React.useContext(SubscriptionContext);
}
