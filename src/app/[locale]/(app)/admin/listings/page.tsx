import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminListings } from '@/components/admin/admin-listings';

export const dynamic = 'force-dynamic';

export default async function AdminListingsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('cardListings')}</h1>
        <p className="text-sm text-muted-foreground">{t('listingsSubtitle')}</p>
      </header>
      <AdminListings locale={params.locale} />
    </div>
  );
}
