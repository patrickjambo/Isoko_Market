import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LifeBuoy, Plus, ChevronRight } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { SupportLive } from '@/components/support/support-live';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<string, 'success' | 'muted' | 'secondary'> = {
  OPEN: 'secondary',
  PENDING: 'muted',
  RESOLVED: 'success',
  CLOSED: 'muted',
};

export default async function SupportPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }
  const t = await getTranslations('support');

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: user.id },
    orderBy: { lastReplyAt: 'desc' },
    select: { id: true, subject: true, status: true, category: true, lastReplyAt: true },
  });

  return (
    <div className="container max-w-2xl space-y-5 py-6">
      <SupportLive />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild>
          <Link href="/support/new">
            <Plus className="h-4 w-4" /> {t('newTicket')}
          </Link>
        </Button>
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={t('emptyTitle')}
          description={t('emptyBody')}
          action={
            <Button asChild>
              <Link href="/support/new">
                <Plus className="h-4 w-4" /> {t('newTicket')}
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/support/${ticket.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {[t(`category_${ticket.category}`), timeAgo(ticket.lastReplyAt, params.locale)].join(
                      ' · '
                    )}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[ticket.status] ?? 'muted'}>
                  {t(`status_${ticket.status}`)}
                </Badge>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
