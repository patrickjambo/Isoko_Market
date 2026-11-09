'use client';

import * as React from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { PushPromptModal } from '@/components/notifications/push-prompt-modal';
import { VerificationPromptModal } from '@/components/verification/verification-prompt-modal';
import type { SessionUser } from '@/lib/serialize';
import type { FeatureFlags } from '@/lib/feature-flags';
import { FeatureFlagsProvider, useFeatureFlags } from './providers/feature-flags-provider';
import {
  SubscriptionProvider,
  useSubscriptionSettings,
} from './providers/subscription-provider';
import type { SubscriptionSettings } from './providers/subscription-provider';

export { useFeatureFlags, useSubscriptionSettings };

/** Client-side access to the current session user (avatar, role, wallet…). */
const SessionContext = React.createContext<SessionUser | null>(null);

export function useSession(): SessionUser | null {
  return React.useContext(SessionContext);
}

export function Providers({
  user,
  initialFlags,
  initialSubscriptionSettings,
  children,
}: {
  user: SessionUser | null;
  initialFlags?: FeatureFlags;
  initialSubscriptionSettings?: SubscriptionSettings;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={user}>
      <FeatureFlagsProvider initialFlags={initialFlags}>
        <SubscriptionProvider initialSettings={initialSubscriptionSettings}>
          <ToastProvider>
            {children}
            <PushPromptModal />
            <VerificationPromptModal />
          </ToastProvider>
        </SubscriptionProvider>
      </FeatureFlagsProvider>
    </SessionContext.Provider>
  );
}

