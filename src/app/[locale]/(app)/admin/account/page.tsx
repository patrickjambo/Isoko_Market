import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth';
import { AccountForm } from '@/components/admin/account-form';

export const dynamic = 'force-dynamic';

export default async function AdminAccountPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('adminAccount');
  // The /admin layout already guarantees an ADMIN is signed in.
  const user = await getCurrentUser();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>
      <AccountForm currentEmail={user?.email ?? ''} />
    </div>
  );
}
