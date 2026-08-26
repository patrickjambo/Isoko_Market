import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Gift, Users, Wallet } from 'lucide-react';
import { redirect } from '@/i18n/routing';
import { ReferralShare } from '@/components/referral/referral-share';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uniqueReferralCode } from '@/lib/referral';
import { env } from '@/lib/env';
import { formatRWF } from '@/lib/utils';
import { REFERRAL_BONUS } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

export default async function ReferralsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('referrals');

  // Backfill a code for accounts created before referrals existed.
  let code = user.referralCode;
  if (!code) {
    code = await uniqueReferralCode();
    await prisma.user.update({ where: { id: user.id }, data: { referralCode: code } });
  }

  const [invitedCount, earnedAgg] = await Promise.all([
    prisma.user.count({ where: { referredById: user.id } }),
    prisma.transaction.aggregate({
      where: { userId: user.id, type: 'TOPUP', status: 'SUCCESS' },
      _sum: { amount: true },
    }),
  ]);

  const link = `${env.NEXT_PUBLIC_APP_URL}/${params.locale}/register?ref=${code}`;

  return (
    <div className="container max-w-lg py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Gift className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <Users className="mb-2 h-5 w-5 text-primary" />
          <p className="text-2xl font-extrabold">{invitedCount}</p>
          <p className="text-xs text-muted-foreground">{t('invited')}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Wallet className="mb-2 h-5 w-5 text-success" />
          <p className="text-2xl font-extrabold">
            {formatRWF(earnedAgg._sum.amount ?? 0, params.locale)}
          </p>
          <p className="text-xs text-muted-foreground">{t('earned')}</p>
        </div>
      </div>

      <ReferralShare code={code} link={link} />

      <div className="mt-6 rounded-xl bg-secondary/40 p-4">
        <h2 className="mb-1 font-semibold">{t('howItWorks')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('howBody', { amount: `RWF ${REFERRAL_BONUS.toLocaleString()}` })}
        </p>
      </div>
    </div>
  );
}
