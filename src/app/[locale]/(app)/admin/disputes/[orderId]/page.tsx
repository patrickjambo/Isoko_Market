import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShoppingBag, User } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { AdminLiveRefresh } from '@/components/admin/admin-live-refresh';
import { SecureImage } from '@/components/admin/secure-image';
import { DisputeResolve } from '@/components/admin/dispute-resolve';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { effectivePermissions } from '@/lib/permissions';
import { formatRWF, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminDisputePage({
  params,
}: {
  params: { locale: string; orderId: string };
}) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) notFound();
  const perms = await effectivePermissions(user);
  if (!perms.has('moderation.view')) notFound();
  const canResolve = perms.has('moderation.resolve');
  const t = await getTranslations('admin');

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      status: true,
      amount: true,
      createdAt: true,
      buyerPaymentProofUrl: true,
      disputeReportId: true,
      listing: { select: { id: true, title: true } },
      buyer: { select: { id: true, fullName: true } },
      seller: { select: { id: true, fullName: true } },
    },
  });
  if (!order) notFound();

  const report = order.disputeReportId
    ? await prisma.report.findUnique({
        where: { id: order.disputeReportId },
        select: { details: true, createdAt: true },
      })
    : null;

  const isOpen = order.status === 'DISPUTED';

  return (
    <div className="space-y-5">
      <AdminLiveRefresh />

      <Link
        href="/admin/disputes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t('backToDisputes')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <Link href={`/marketplace/${order.listing.id}`} className="text-xl font-bold hover:underline">
              {order.listing.title}
            </Link>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatRWF(order.amount)} · {timeAgo(order.createdAt, params.locale)}
          </p>
        </div>
        <Badge variant={isOpen ? 'destructive' : 'muted'}>
          {isOpen ? t('underDispute') : t('disputeClosed')}
        </Badge>
      </div>

      {/* Parties */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: t('disputeBuyer'), person: order.buyer },
          { label: t('disputeSeller'), person: order.seller },
        ].map((p) => (
          <div key={p.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.label}</p>
            <Link
              href={`/profile/${p.person.id}`}
              className="mt-1 flex items-center gap-2 font-semibold hover:underline"
            >
              <User className="h-4 w-4 text-muted-foreground" /> {p.person.fullName}
            </Link>
          </div>
        ))}
      </div>

      {/* Payment timeline (captured when the dispute was opened) */}
      {report?.details && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t('disputeTimeline')}</h3>
          <pre className="whitespace-pre-wrap break-words font-sans text-sm text-muted-foreground">
            {report.details}
          </pre>
        </div>
      )}

      {/* Proof of payment */}
      {order.buyerPaymentProofUrl && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 font-semibold">{t('paymentProof')}</h3>
          <SecureImage
            src={`/api/admin/disputes/${order.id}/proof`}
            alt={t('paymentProof')}
            unavailableLabel={t('proofUnavailable')}
          />
        </div>
      )}

      {/* Resolution */}
      {isOpen ? (
        canResolve ? (
          <DisputeResolve orderId={order.id} />
        ) : (
          <p className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
            {t('disputeReadOnly')}
          </p>
        )
      ) : (
        <p className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {t('disputeAlreadyResolved')}
        </p>
      )}
    </div>
  );
}
