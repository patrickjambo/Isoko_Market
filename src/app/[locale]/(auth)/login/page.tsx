import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { AuthForm } from '@/components/auth/auth-form';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { returnTo?: string };
}) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (user) redirect({ href: searchParams.returnTo || '/', locale: params.locale });
  return <AuthForm mode="login" returnTo={searchParams.returnTo} />;
}
