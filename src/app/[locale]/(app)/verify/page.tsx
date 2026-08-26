import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShieldQuestion } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { VerifyForm } from '@/components/verification/verify-form';

export default async function VerifyPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('verification');

  return (
    <div className="container max-w-lg py-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t('subtitle')}</p>
      <VerifyForm status={user.verificationStatus} />
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
