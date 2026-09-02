import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Package, ImageOff, ShoppingBag, Store } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { EmptyState } from '@/components/shared/empty-state';
import { PollRefresh } from '@/components/shared/poll-refresh';
import { OrderStatusBadge } from '@/components/orders/order-status';
import { getCurrentUser } from '@/lib/auth';
import { getOrdersForUser } from '@/lib/orders';
import { formatRWF, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OrdersPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('orders');
  const orders = await getOrdersForUser(user.id);

  return (
    <div className="container max-w-2xl py-6">
      <PollRefresh />
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{t('title')}</h1>

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t('empty')}
          description={t('emptyHint')}
          action={
            <Link href="/marketplace" className="text-sm font-semibold text-primary hover:underline">
              {t('browse')}
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-secondary/40"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {o.listing.images[0] ? (
                    <Image src={o.listing.images[0].url} alt="" fill sizes="56px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <ImageOff className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{o.listing.title}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      {o.role === 'buyer' ? <ShoppingBag className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                      {o.role === 'buyer' ? t('buying') : t('selling')}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-primary">{formatRWF(o.amount, params.locale)}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.counterpart?.fullName} · {timeAgo(o.createdAt, params.locale)}
                  </p>
                </div>
                <OrderStatusBadge status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
