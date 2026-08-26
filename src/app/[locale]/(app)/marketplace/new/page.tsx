import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { getCategories } from '@/lib/queries';
import { categoryName } from '@/lib/i18n-helpers';
import { CreateListingForm } from '@/components/marketplace/create-listing-form';

export default async function NewListingPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: '/login', locale: params.locale });

  const t = await getTranslations('marketplace');
  const categories = await getCategories();

  return (
    <div className="container max-w-2xl py-6">
      <Link
        href="/marketplace"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> {t('title')}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t('createTitle')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t('createSubtitle')}</p>
      <CreateListingForm
        categories={categories.map((c) => ({ id: c.id, name: categoryName(c, params.locale) }))}
      />
    </div>
  );
}
