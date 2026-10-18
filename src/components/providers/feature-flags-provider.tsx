'use client';

import * as React from 'react';
import { useRouter } from '@/i18n/routing';
import type { FeatureFlags } from '@/lib/feature-flags';
import type { RealtimeEvent } from '@/lib/realtime';

const DEFAULT_FLAGS: FeatureFlags = {
  jobsEnabled: false,
  hiringEnabled: false,
  cvBuilderEnabled: false,
};

const FeatureFlagsContext = React.createContext<FeatureFlags>(DEFAULT_FLAGS);

const BROADCAST_CHANNEL_NAME = 'zenova:feature-flags';
const WINDOW_EVENT_NAME = 'zenova:feature-flags-updated';

/**
 * Dispatch an immediate feature flag change across all browser tabs and in-memory listeners.
 * Used by admin forms so UI updates in <1ms without waiting for network round-trips.
 */
export function broadcastFeatureFlagChange(flags: FeatureFlags): void {
  if (typeof window === 'undefined') return;

  // 1. Cross-tab sync via BroadcastChannel
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage({ flags });
      channel.close();
    }
  } catch {
    /* BroadcastChannel unsupported or blocked */
  }

  // 2. Same-window custom event
  try {
    window.dispatchEvent(new CustomEvent(WINDOW_EVENT_NAME, { detail: flags }));
  } catch {
    /* ignore */
  }
}

export function FeatureFlagsProvider({
  initialFlags,
  children,
}: {
  initialFlags?: FeatureFlags;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [flags, setFlags] = React.useState<FeatureFlags>(initialFlags ?? DEFAULT_FLAGS);
  const flagsRef = React.useRef<FeatureFlags>(flags);
  flagsRef.current = flags;

  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced server component refresh so Server Components (like home page,
  // profile page) update seamlessly without stuttering or full page reloads.
  const triggerServerRefresh = React.useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      router.refresh();
    }, 250);
  }, [router]);

  // Handle incoming flag updates from any source (SSE, BroadcastChannel, window event)
  const applyFlags = React.useCallback(
    (nextFlags: FeatureFlags) => {
      const prev = flagsRef.current;
      const changed =
        prev.jobsEnabled !== nextFlags.jobsEnabled ||
        prev.hiringEnabled !== nextFlags.hiringEnabled ||
        prev.cvBuilderEnabled !== nextFlags.cvBuilderEnabled;

      if (changed) {
        setFlags(nextFlags);
        triggerServerRefresh();
      }
    },
    [triggerServerRefresh]
  );

  // Sync when initialFlags prop changes from server re-render
  React.useEffect(() => {
    if (initialFlags) {
      applyFlags(initialFlags);
    }
  }, [initialFlags, applyFlags]);

  // 1. Cross-tab sync via BroadcastChannel
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<{ flags?: FeatureFlags }>) => {
        if (event.data?.flags) {
          applyFlags(event.data.flags);
        }
      };
      return () => channel.close();
    } catch {
      return;
    }
  }, [applyFlags]);

  // 2. Local window event listener
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleCustomEvent = (e: Event) => {
      const detail = (e as CustomEvent<FeatureFlags>).detail;
      if (detail) {
        applyFlags(detail);
      }
    };
    window.addEventListener(WINDOW_EVENT_NAME, handleCustomEvent);
    return () => window.removeEventListener(WINDOW_EVENT_NAME, handleCustomEvent);
  }, [applyFlags]);

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
          if (parsed.type === 'feature_flags_updated' && parsed.flags) {
            applyFlags(parsed.flags);
          }
        } catch {
          /* ignore ping comments or non-JSON payloads */
        }
      };

      source.onerror = () => {
        // EventSource auto-retries, but if it closes completely, reconnect after 5s
        if (source?.readyState === EventSource.CLOSED) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      source?.close();
    };
  }, [applyFlags]);

  // 4. Tab visibility / focus sync fallback
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncOnFocus = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/feature-flags', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json?.data) {
            applyFlags(json.data);
          }
        }
      } catch {
        /* ignore network errors on resume */
      }
    };

    document.addEventListener('visibilitychange', syncOnFocus);
    window.addEventListener('focus', syncOnFocus);
    return () => {
      document.removeEventListener('visibilitychange', syncOnFocus);
      window.removeEventListener('focus', syncOnFocus);
    };
  }, [applyFlags]);

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Access the reactive, real-time feature flags state anywhere in client components.
 * Updates seamlessly when admin toggles any flag without requiring page refresh.
 */
export function useFeatureFlags(): FeatureFlags {
  return React.useContext(FeatureFlagsContext);
}
