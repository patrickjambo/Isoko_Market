import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminContent } from '@/components/admin/admin-content';

export const dynamic = 'force-dynamic';

export default async function ContentPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('content')}</h1>
        <p className="text-sm text-muted-foreground">{t('contentSubtitle')}</p>
      </header>
      <AdminContent />
    </div>
  );
}
