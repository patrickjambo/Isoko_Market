import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertTriangle } from 'lucide-react';
import { redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { AuthForm } from '@/components/auth/auth-form';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { returnTo?: string; error?: string };
}) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (user) redirect({ href: searchParams.returnTo || '/', locale: params.locale });

  // Magic-link handler bounces expired/used links here (?error=link) and rate-limited
  // attempts (?error=rate) — tell the user so "request a new code" is the obvious next step.
  const t = await getTranslations('auth');
  const errorMsg =
    searchParams.error === 'link'
      ? t('linkExpired')
      : searchParams.error === 'rate'
        ? t('tooManyAttempts')
        : null;

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      <AuthForm mode="login" returnTo={searchParams.returnTo} />
    </div>
  );
}
