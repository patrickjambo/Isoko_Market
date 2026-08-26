import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Wallet, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { TransactionType, TransactionStatus } from '@prisma/client';
import { redirect } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { TopUpDialog } from '@/components/wallet/topup-dialog';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatRWF, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const statusVariant: Record<TransactionStatus, 'success' | 'muted' | 'destructive'> = {
  SUCCESS: 'success',
  PENDING: 'muted',
  FAILED: 'destructive',
  REFUNDED: 'muted',
};

export default async function WalletPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('wallet');
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="container max-w-2xl py-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{t('title')}</h1>

      <div className="brand-gradient mb-6 flex items-center justify-between rounded-2xl p-6 text-white">
        <div>
          <p className="text-sm text-white/80">{t('balance')}</p>
          <p className="text-3xl font-extrabold">{formatRWF(user.walletBalance, params.locale)}</p>
        </div>
        <TopUpDialog />
      </div>

      <h2 className="mb-3 font-semibold">{t('history')}</h2>
      {transactions.length === 0 ? (
        <EmptyState icon={Wallet} title={t('empty')} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {transactions.map((tx) => {
            const isCredit = tx.type === 'TOPUP';
            return (
              <li key={tx.id} className="flex items-center gap-3 p-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full ${
                    isCredit ? 'bg-success/10 text-success' : 'bg-secondary text-primary'
                  }`}
                >
                  {isCredit ? (
                    <ArrowDownLeft className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t(`type.${tx.type as TransactionType}`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {timeAgo(tx.createdAt, params.locale)} · {tx.provider}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${isCredit ? 'text-success' : ''}`}>
                    {isCredit ? '+' : ''}
                    {formatRWF(tx.amount, params.locale)}
                  </p>
                  <Badge variant={statusVariant[tx.status]}>
                    {t(`txStatus.${tx.status}`)}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
