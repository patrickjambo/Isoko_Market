'use client';

import * as React from 'react';
import type { SubscriptionSettings } from '@/lib/realtime';

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
  const [settings, setSettings] = React.useState<SubscriptionSettings>(
    initialSettings ?? DEFAULT_SETTINGS
  );
  const settingsRef = React.useRef<SubscriptionSettings>(settings);
  settingsRef.current = settings;

  const applySettings = React.useCallback((next: SubscriptionSettings) => {
    setSettings(next);
  }, []);

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
