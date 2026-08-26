import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminUsers } from '@/components/admin/admin-users';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('users')}</h1>
        <p className="text-sm text-muted-foreground">{t('usersSubtitle')}</p>
      </header>
      <AdminUsers locale={params.locale} />
    </div>
  );
}
