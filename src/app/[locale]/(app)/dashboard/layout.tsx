import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { getUnreadMessageCount } from '@/lib/queries';
import { prisma } from '@/lib/prisma';
import { SellerShell } from '@/components/seller/seller-shell';

export const dynamic = 'force-dynamic';

/** Seller dashboard chrome — auth-gated collapsible sidebar; a seller only ever
 *  sees their own data. */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  // Service requests still awaiting this provider's confirm/decline — the badge
  // is the "you have work to do" signal, mirroring unread messages.
  const [unread, pendingRequests] = await Promise.all([
    getUnreadMessageCount(user.id),
    prisma.serviceRequest.count({ where: { providerId: user.id, status: 'REQUESTED' } }),
  ]);

  return (
    <SellerShell unread={unread} pendingRequests={pendingRequests}>
      {children}
    </SellerShell>
  );
}
