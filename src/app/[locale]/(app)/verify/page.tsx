import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShieldQuestion } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { VerifyForm } from '@/components/verification/verify-form';
import { getFeatureFlags } from '@/lib/feature-flags';

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { returnTo?: string };
}) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const [t, flags] = await Promise.all([getTranslations('verification'), getFeatureFlags()]);
  const jobsAny = flags.jobsEnabled || flags.hiringEnabled || flags.cvBuilderEnabled;

  // Sanitize returnTo: only allow relative paths to prevent open redirects.
  const rawReturnTo = searchParams?.returnTo ?? '';
  const returnTo = rawReturnTo.startsWith('/') ? rawReturnTo : '/';

  return (
    <div className="container max-w-lg py-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {jobsAny ? t('subtitle') : t('subtitleNoJobs')}
      </p>
      <VerifyForm status={user.verificationStatus} returnTo={returnTo} />
      {/* Plain-language "why we ask for ID / is it safe" — Visitor spec §7 */}
      <Link
        href="/safety"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ShieldQuestion className="h-4 w-4" /> {t('howVerificationWorks')}
      </Link>
    </div>
  );
}
