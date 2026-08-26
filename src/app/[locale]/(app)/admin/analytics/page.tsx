import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminAnalytics } from '@/components/admin/admin-analytics';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('analytics')}</h1>
        <p className="text-sm text-muted-foreground">{t('analyticsSubtitle')}</p>
      </header>
      <AdminAnalytics />
    </div>
  );
}
