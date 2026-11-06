import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { effectivePermissions } from '@/lib/permissions';
import { getPlatformSettings } from '@/lib/commission';
import { CommissionForm } from '@/components/admin/commission-form';
import { FeatureFlagsForm } from '@/components/admin/feature-flags-form';
import { SubscriptionSettingsForm } from '@/components/admin/subscription-settings-form';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user || !(await effectivePermissions(user)).has('settings.view')) notFound();
  const t = await getTranslations('commission');
  const tf = await getTranslations('featureFlags');
  const ts = await getTranslations('subscription');

  const s = await getPlatformSettings();

  return (
    <div className="space-y-10">
      {/* ── Feature Flags ─────────────────────────────────────────── */}
      <section className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">{tf('title')}</h1>
          <p className="text-sm text-muted-foreground">{tf('subtitle')}</p>
        </header>
        <FeatureFlagsForm
          initial={{
            jobsEnabled: s.jobsEnabled,
            hiringEnabled: s.hiringEnabled,
            cvBuilderEnabled: s.cvBuilderEnabled,
          }}
        />
      </section>

      <hr className="border-border" />

      {/* ── Seller Subscriptions ──────────────────────────────────── */}
      <section className="space-y-5">
        <header>
          <h2 className="text-xl font-bold tracking-tight">{ts('adminTitle')}</h2>
          <p className="text-sm text-muted-foreground">{ts('adminSubtitle')}</p>
        </header>
        <SubscriptionSettingsForm
          initial={{
            subscriptionEnabled: s.subscriptionEnabled,
            subscriptionMonthlyPrice: s.subscriptionMonthlyPrice,
            subscriptionAnnualPrice: s.subscriptionAnnualPrice,
            subscriptionMomoNumber: s.subscriptionMomoNumber,
            subscriptionMomoKind: s.subscriptionMomoKind,
            subscriptionRequireOnPublish: s.subscriptionRequireOnPublish,
            subscriptionAutoExpireMonths: s.subscriptionAutoExpireMonths,
            subscriptionAutoExpireListings: s.subscriptionAutoExpireListings,
          }}
        />
      </section>

      <hr className="border-border" />

      {/* ── Commission ────────────────────────────────────────────── */}
      <section className="space-y-5">
        <header>
          <h2 className="text-xl font-bold tracking-tight">{t('title')}</h2>
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
      </section>
    </div>
  );
}
