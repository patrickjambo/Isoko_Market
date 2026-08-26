import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCategories } from '@/lib/queries';
import { categoryName } from '@/lib/i18n-helpers';
import { AddProductWizard } from '@/components/seller/add-product-wizard';

export const dynamic = 'force-dynamic';

export default async function SellPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('sell');
  const categories = await getCategories();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t('subtitle')}</p>
      <AddProductWizard
        categories={categories.map((c) => ({ id: c.id, name: categoryName(c, params.locale) }))}
      />
    </div>
  );
}
