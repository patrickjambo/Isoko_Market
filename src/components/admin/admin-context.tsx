'use client';

import * as React from 'react';

/**
 * Supplies the current admin's effective permission set to every admin client
 * component, so the UI can hide/disable actions the admin lacks (rather than
 * only failing server-side with a 403).
 */
const Ctx = React.createContext<{ permissions: Set<string>; adminRole: string | null }>({
  permissions: new Set(),
  adminRole: null,
});

export function AdminPermissionsProvider({
  permissions,
  adminRole,
  children,
}: {
  permissions: string[];
  adminRole: string | null;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ permissions: new Set(permissions), adminRole }),
    [permissions, adminRole]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Returns a `can(key)` predicate for the current admin. */
export function useCan() {
  const { permissions } = React.useContext(Ctx);
  return React.useCallback((key: string) => permissions.has(key), [permissions]);
}

export function useAdminRole() {
  return React.useContext(Ctx).adminRole;
}
