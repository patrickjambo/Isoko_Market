import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChevronLeft, ShieldCheck, Info, ImageOff, AlertTriangle, Clock } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { StarRating } from '@/components/trust/star-rating';
import { VerifiedBadge } from '@/components/trust/verified-badge';
import { OrderStatusBadge, OrderTimeline } from '@/components/orders/order-status';
import { OrderActions } from '@/components/orders/order-actions';
import { PaymentInstructions } from '@/components/orders/payment-instructions';
import { OrderReview } from '@/components/orders/order-review';
import { LiveItemStatus } from '@/components/shared/live-item-status';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { formatRWF } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('orders');
  const tt = await getTranslations('trust');

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      listing: { select: { id: true, title: true, images: { take: 1, orderBy: { position: 'asc' }, select: { url: true } } } },
      buyer: { select: { id: true, fullName: true } },
      seller: { select: { id: true, fullName: true, isVerified: true, verificationStatus: true, paymentNumber: true, paymentProvider: true } },
    },
  });
  if (!order) notFound();
  // Access gate via the shared authorizer (rule 5). Non-participants get a 404.
  if (!(await can(user, 'order:view', order))) notFound();
  const role = order.buyerId === user.id ? 'buyer' : 'seller';

  // Prefer the snapshot; fall back to the seller's current number so an order
  // placed before they set a payout reveals it the moment they add one.
  const payoutNumber = order.sellerPayoutNumber ?? order.seller.paymentNumber ?? null;
  const awaitingSellerPayout = order.status === 'PENDING_PAYMENT' && !payoutNumber;

  const [ratingAgg, completedSales] = await Promise.all([
    prisma.review.aggregate({ where: { revieweeId: order.sellerId }, _avg: { rating: true }, _count: true }),
    prisma.order.count({ where: { sellerId: order.sellerId, status: 'COMPLETED' } }),
  ]);

  const canReview = role === 'buyer' && order.status === 'COMPLETED' && !order.reviewed;

  return (
    <div className="container max-w-2xl space-y-5 py-6">
      <LiveItemStatus topic={`order:${order.id}`} />
      <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> {t('title')}
      </Link>

      {/* Item + status */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          {order.listing.images[0] ? (
            <Image src={order.listing.images[0].url} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ImageOff className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/marketplace/${order.listing.id}`} className="truncate font-semibold hover:text-primary">
            {order.listing.title}
          </Link>
          <p className="text-lg font-extrabold text-primary">{formatRWF(order.amount, params.locale)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Timeline */}
      {order.status !== 'CANCELLED' && (
        <div className="rounded-xl border border-border bg-card p-4">
          <OrderTimeline status={order.status} />
        </div>
      )}

      {order.status === 'DISPUTED' && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p>{t('disputedNote')}</p>
        </div>
      )}

      {/* Manual payment: buyer sees the seller's number to pay; seller is prompted to check their app */}
      <div className="space-y-2">
        {role === 'buyer' && order.status === 'PENDING_PAYMENT' && payoutNumber && (
          <PaymentInstructions
            payoutNumber={payoutNumber}
            method={order.paymentMethod}
            amountLabel={formatRWF(order.amount, params.locale)}
          />
        )}
        {/* Buyer ordered before the seller set a payout number — the seller has
            been notified; the number will appear here once they add it. */}
        {role === 'buyer' && awaitingSellerPayout && (
          <div className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/5 p-3 text-sm">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>{t('awaitingPayoutBuyer')}</p>
          </div>
        )}
        {/* Seller has an order but no payout number — nudge them to add one. */}
        {role === 'seller' && awaitingSellerPayout && (
          <div className="space-y-2 rounded-xl border border-accent/40 bg-accent/5 p-3 text-sm">
            <p className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {t('awaitingPayoutSeller')}
            </p>
            <Link
              href="/profile/settings"
              className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
            >
              {t('addPayoutCta')}
            </Link>
          </div>
        )}
        {role === 'seller' && order.status === 'BUYER_MARKED_PAID' && (
          <div className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/5 p-3 text-sm">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>{t('sellerCheckApp', { amount: formatRWF(order.amount, params.locale) })}</p>
          </div>
        )}
        <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p>{t('safetyTip')}</p>
        </div>
      </div>

      {/* Counterpart trust (buyer sees seller trust prominently) */}
      {role === 'buyer' && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold">{order.seller.fullName}</span>
            {order.seller.isVerified && <VerifiedBadge status="VERIFIED" label={tt('verifiedBadge')} />}
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            {ratingAgg._count > 0 ? (
              <StarRating value={ratingAgg._avg.rating ?? 0} count={ratingAgg._count} />
            ) : (
              <span>{t('noRatingYet')}</span>
            )}
            <span>{t('completedSales', { count: completedSales })}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <OrderActions orderId={order.id} status={order.status} role={role} />

      {/* Review */}
      {canReview && <OrderReview orderId={order.id} />}
      {role === 'buyer' && order.reviewed && (
        <p className="text-sm text-muted-foreground">{t('reviewDone')}</p>
      )}
    </div>
  );
}
