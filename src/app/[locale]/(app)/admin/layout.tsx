import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { effectivePermissions } from '@/lib/permissions';
import { AdminShell } from '@/components/admin/admin-shell';
import { AdminLive } from '@/components/admin/admin-live';
import { AdminPermissionsProvider } from '@/components/admin/admin-context';

export const dynamic = 'force-dynamic';

/**
 * Admin dashboard chrome: one ADMIN guard for every /admin/* route, a
 * collapsible permission-aware sidebar, the shared permission context (so the
 * UI hides actions the admin can't perform), and the real-time layer. Sidebar
 * badge counts refresh live via <AdminLive/>.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') notFound(); // hide /admin from non-admins

  // Fail CLOSED: compute the admin's REAL effective permissions. An ADMIN with
  // no explicit sub-role gets an EMPTY set (they must be assigned one) — never
  // silently treated as SUPER_ADMIN. This keeps the sidebar/UI consistent with
  // effectivePermissions() + adminRoute() (which also deny a null sub-role);
  // otherwise a role-less admin would SEE every panel while the API denied every
  // action ("even I see admin/superadmin/moderator dashboards").
  const adminRole = user.adminRole; // may be null → least privilege
  const permissions = [...(await effectivePermissions(user))];

  const [reports, verifications] = await Promise.all([
    prisma.report.count({ where: { status: { in: ['OPEN', 'REVIEWING'] } } }),
    prisma.verificationRequest.count({ where: { status: 'PENDING' } }),
  ]);

  return (
    <AdminPermissionsProvider permissions={permissions} adminRole={adminRole}>
      <AdminLive />
      <AdminShell counts={{ reports, verifications }} permissions={permissions}>
        {children}
      </AdminShell>
    </AdminPermissionsProvider>
  );
}
