import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminAudit } from '@/components/admin/admin-audit';

export const dynamic = 'force-dynamic';

export default async function AuditPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('auditLog')}</h1>
        <p className="text-sm text-muted-foreground">{t('auditSubtitle')}</p>
      </header>
      <AdminAudit locale={params.locale} />
    </div>
  );
}
