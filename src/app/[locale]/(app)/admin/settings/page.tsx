import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { effectivePermissions } from '@/lib/permissions';
import { getPlatformSettings } from '@/lib/commission';
import { CommissionForm } from '@/components/admin/commission-form';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user || !(await effectivePermissions(user)).has('settings.view')) notFound();
  const t = await getTranslations('commission');

  const s = await getPlatformSettings();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <CommissionForm
        initial={{
          commissionEnabled: s.commissionEnabled,
          commissionType: s.commissionType,
          commissionPercent: s.commissionPercent,
          commissionFixed: s.commissionFixed,
          commissionMin: s.commissionMin,
          commissionMax: s.commissionMax,
          payoutKind: s.payoutKind,
          payoutValue: s.payoutValue,
          chargingStartsAt: s.chargingStartsAt ? s.chargingStartsAt.toISOString() : null,
          freePeriodDays: s.freePeriodDays,
        }}
      />
    </div>
  );
}
