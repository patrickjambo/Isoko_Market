import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { SettingsForm } from '@/components/profile/settings-form';

export default async function SettingsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('profile');

  return (
    <div className="container max-w-lg py-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t('settings')}</h1>
      <SettingsForm
        initial={{
          fullName: user.fullName,
          bio: user.bio ?? '',
          location: user.location ?? '',
          avatarUrl: user.avatarUrl,
          paymentNumber: user.paymentNumber,
          paymentProvider: user.paymentProvider,
        }}
      />
    </div>
  );
}
