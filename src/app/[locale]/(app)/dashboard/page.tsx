import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  Package,
  TrendingUp,
  Wallet,
  ShieldCheck,
  Lightbulb,
  MessageCircle,
  ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { requireWorkspace } from '@/lib/workspace-guard';
import { prisma } from '@/lib/prisma';
import { getSellerInsights } from '@/lib/seller-insights';
import { formatRWF } from '@/lib/utils';
import { Trend } from '@/components/admin/sparkline';
import { VerifiedBadge } from '@/components/trust/verified-badge';

export const dynamic = 'force-dynamic';

export default async function SellerHome({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('seller');
  const tt = await getTranslations('trust');

  // Seller-only workspace — non-sellers are sent to their own home.
  const user = await requireWorkspace('seller', params.locale);
  const [insights, unread] = await Promise.all([
    getSellerInsights(user.id),
    prisma.message.count({
      where: {
        conversation: { participants: { some: { userId: user.id } } },
        senderId: { not: user.id },
        readAt: null,
      },
    }),
  ]);

  const interest = insights.viewsTotal + insights.messagesThisWeek;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('greeting', { name: user.fullName.split(' ')[0]! })}</h1>
        <p className="text-sm text-muted-foreground">{t('homeSubtitle')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Suggested action — full width, dynamic */}
        {insights.suggestion && (
          <Link
            href="/dashboard/listings"
            className="group flex items-start gap-3 rounded-xl border border-accent/40 bg-accent/5 p-4 sm:col-span-2"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-accent-foreground/90">{t('suggestedAction')}</p>
              <p className="text-sm text-muted-foreground">
                {t(`suggest_${insights.suggestion.type}`, { title: insights.suggestion.title })}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        )}

        <Card href="/dashboard/listings" icon={Package} label={t('cardMyListings')}>
          <p className="text-2xl font-extrabold">{insights.activeCount}</p>
          <p className="text-xs text-muted-foreground">
            {t('activeListings')} · {t('soldThisMonth', { count: insights.soldThisMonth })}
          </p>
        </Card>

        <Card href="/dashboard/listings" icon={TrendingUp} label={t('cardInterest')}>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-extrabold">{interest}</p>
            <Trend current={insights.messagesThisWeek} previous={insights.messagesPrevWeek} />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('viewsMessages', { views: insights.viewsTotal, messages: insights.messagesThisWeek })}
          </p>
        </Card>

        <Card href="/wallet" icon={Wallet} label={t('cardWallet')}>
          <p className="text-2xl font-extrabold text-primary">
            {formatRWF(user.walletBalance, params.locale)}
          </p>
          <p className="text-xs text-muted-foreground">{t('available')}</p>
        </Card>

        <Card href="/verify" icon={ShieldCheck} label={t('cardVerification')}>
          <VerifiedBadge
            status={user.verificationStatus as 'VERIFIED' | 'PENDING' | 'UNVERIFIED'}
            label={user.isVerified ? tt('verifiedBadge') : undefined}
            size="md"
          />
          {!user.isVerified && (
            <p className="mt-1 text-xs text-accent">{t('oneStepLeft')}</p>
          )}
        </Card>

        <Card href="/messages" icon={MessageCircle} label={t('cardMessages')}>
          <p className="text-2xl font-extrabold">{unread}</p>
          <p className="text-xs text-muted-foreground">{t('unreadMessages')}</p>
        </Card>
      </div>
    </div>
  );
}

function Card({
  href,
  icon: Icon,
  label,
  children,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </span>
      {children}
    </Link>
  );
}
