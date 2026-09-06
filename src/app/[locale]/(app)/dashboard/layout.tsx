import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { getUnreadMessageCount } from '@/lib/queries';
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

  const unread = await getUnreadMessageCount(user.id);

  return <SellerShell unread={unread}>{children}</SellerShell>;
}
