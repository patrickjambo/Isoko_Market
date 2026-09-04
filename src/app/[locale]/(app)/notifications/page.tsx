import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  Bell,
  MessageCircle,
  Briefcase,
  ShoppingBag,
  BadgeCheck,
  Star,
  Wallet,
  Megaphone,
  Heart,
} from 'lucide-react';
import type { NotificationType } from '@prisma/client';
import { Link, redirect } from '@/i18n/routing';
import { EmptyState } from '@/components/shared/empty-state';
import { MarkAllReadButton } from '@/components/notifications/mark-all-read';
import { PollRefresh } from '@/components/shared/poll-refresh';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { timeAgo, cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const ICONS: Record<NotificationType, typeof Bell> = {
  MESSAGE: MessageCircle,
  APPLICATION_UPDATE: Briefcase,
  LISTING_SOLD: ShoppingBag,
  VERIFICATION_APPROVED: BadgeCheck,
  VERIFICATION_REJECTED: BadgeCheck,
  REVIEW_RECEIVED: Star,
  PAYMENT: Wallet,
  FAVORITE: Heart,
  SYSTEM: Megaphone,
};

export default async function NotificationsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('notifications');
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="container max-w-2xl py-6">
      {/* New notifications land on their own, no manual reload. */}
      <PollRefresh intervalMs={10000} />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        {notifications.some((n) => !n.readAt) && <MarkAllReadButton />}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title={t('empty')} />
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const Icon = ICONS[n.type];
            const inner = (
              <div
                className={cn(
                  'flex items-start gap-3 rounded-xl border border-border p-3',
                  n.readAt ? 'bg-card' : 'bg-secondary/40'
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{n.title}</p>
                    {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
                  </div>
                  {n.body && <p className="line-clamp-2 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {timeAgo(n.createdAt, params.locale)}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={n.id}>{n.href ? <Link href={n.href}>{inner}</Link> : inner}</li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
