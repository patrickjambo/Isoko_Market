'use client';

import * as React from 'react';
import { ToastProvider } from '@/components/ui/toast';
import type { SessionUser } from '@/lib/serialize';
import type { FeatureFlags } from '@/lib/feature-flags';
import { FeatureFlagsProvider, useFeatureFlags } from './providers/feature-flags-provider';

export { useFeatureFlags };

/** Client-side access to the current session user (avatar, role, wallet…). */
const SessionContext = React.createContext<SessionUser | null>(null);

export function useSession(): SessionUser | null {
  return React.useContext(SessionContext);
}

export function Providers({
  user,
  initialFlags,
  children,
}: {
  user: SessionUser | null;
  initialFlags?: FeatureFlags;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={user}>
      <FeatureFlagsProvider initialFlags={initialFlags}>
        <ToastProvider>{children}</ToastProvider>
      </FeatureFlagsProvider>
    </SessionContext.Provider>
  );
}

