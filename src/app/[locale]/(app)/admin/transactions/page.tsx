import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminTransactions } from '@/components/admin/admin-transactions';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('transactions')}</h1>
        <p className="text-sm text-muted-foreground">{t('transactionsSubtitle')}</p>
      </header>
      <AdminTransactions locale={params.locale} />
    </div>
  );
}
