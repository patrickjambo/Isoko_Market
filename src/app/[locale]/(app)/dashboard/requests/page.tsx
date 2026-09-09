import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PollRefresh } from '@/components/shared/poll-refresh';
import {
  ServiceRequestList,
  type ServiceRequestItem,
} from '@/components/marketplace/service-request-list';

export const dynamic = 'force-dynamic';

export default async function RequestsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('marketplace');
  const [incomingRows, outgoingRows] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { providerId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        listing: { select: { id: true, title: true } },
        requester: { select: { fullName: true, avatarUrl: true } },
      },
    }),
    prisma.serviceRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        listing: { select: { id: true, title: true } },
        provider: { select: { fullName: true, avatarUrl: true } },
      },
    }),
  ]);

  const incoming: ServiceRequestItem[] = incomingRows.map((r) => ({
    id: r.id,
    listingId: r.listing.id,
    listingTitle: r.listing.title,
    personName: r.requester.fullName,
    personAvatar: r.requester.avatarUrl,
    note: r.note,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
  const outgoing: ServiceRequestItem[] = outgoingRows.map((r) => ({
    id: r.id,
    listingId: r.listing.id,
    listingTitle: r.listing.title,
    personName: r.provider.fullName,
    personAvatar: r.provider.avatarUrl,
    note: r.note,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="container max-w-2xl py-6">
      {/* Confirmations/declines land on their own, no manual reload. */}
      <PollRefresh intervalMs={10000} />
      <h1 className="mb-1 text-2xl font-bold tracking-tight">{t('requestsTitle')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t('requestsSubtitle')}</p>
      <ServiceRequestList incoming={incoming} outgoing={outgoing} locale={params.locale} />
    </div>
  );
}
