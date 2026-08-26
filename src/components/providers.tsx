'use client';

import * as React from 'react';
import { ToastProvider } from '@/components/ui/toast';
import type { SessionUser } from '@/lib/serialize';

/** Client-side access to the current session user (avatar, role, wallet…). */
const SessionContext = React.createContext<SessionUser | null>(null);

export function useSession(): SessionUser | null {
  return React.useContext(SessionContext);
}

export function Providers({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={user}>
      <ToastProvider>{children}</ToastProvider>
    </SessionContext.Provider>
  );
}
