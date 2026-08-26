import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { AuthForm } from '@/components/auth/auth-form';
import { isIntent } from '@/lib/onboarding';

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { ref?: string; intent?: string; returnTo?: string };
}) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (user) redirect({ href: searchParams.returnTo || '/', locale: params.locale });
  return (
    <AuthForm
      mode="register"
      referralCode={searchParams.ref}
      intent={isIntent(searchParams.intent) ? searchParams.intent : undefined}
      returnTo={searchParams.returnTo}
    />
  );
}
