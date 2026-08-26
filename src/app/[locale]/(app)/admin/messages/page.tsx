import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminMessages } from '@/components/admin/admin-messages';

export const dynamic = 'force-dynamic';

export default async function MessagesOversightPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('messagesOversight')}</h1>
        <p className="text-sm text-muted-foreground">{t('messagesSubtitle')}</p>
      </header>
      <AdminMessages locale={params.locale} />
    </div>
  );
}
