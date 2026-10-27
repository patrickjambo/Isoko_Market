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
  let errorMsg: string | null = null;
  if (searchParams.error === 'link') {
    errorMsg = t('linkExpired');
  } else if (searchParams.error === 'rate') {
    errorMsg = t('tooManyAttempts');
  } else if (searchParams.error === 'google_denied') {
    errorMsg = t('googleDenied');
  } else if (searchParams.error === 'google_failed' || searchParams.error === 'google_state') {
    errorMsg = t('googleFailed');
  } else if (searchParams.error === 'google_unverified') {
    errorMsg = t('googleUnverified');
  } else if (searchParams.error === 'google_disabled') {
    errorMsg = t('googleDisabled');
  } else if (searchParams.error === 'account_suspended') {
    errorMsg = t('accountSuspended');
  }

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
