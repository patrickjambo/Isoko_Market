import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Tags } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { CategoryAdmin } from '@/components/admin/category-admin';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Curate the taxonomy — including categories sellers added on the fly (dynamic
 * categories). Seller-added ones sort first for review; rename junk or delete
 * duplicates. Deleting keeps listings working (their categoryId becomes null).
 */
export default async function AdminCategoriesPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');

  const categories = await prisma.category.findMany({
    orderBy: [{ nameEn: 'asc' }],
    select: {
      id: true,
      nameEn: true,
      nameRw: true,
      nameFr: true,
      kind: true,
      createdById: true,
      _count: { select: { listings: true } },
    },
  });
  // Seller-added first (they need review), then the rest.
  const sorted = [...categories].sort(
    (a, b) => Number(Boolean(b.createdById)) - Number(Boolean(a.createdById))
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('categoriesTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('categoriesSubtitle')}</p>
      </header>

      {sorted.length === 0 ? (
        <EmptyState icon={Tags} title={t('categoriesEmpty')} />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {sorted.map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.nameEn}</span>
                  <Badge variant={c.kind === 'SERVICE' ? 'outline' : 'secondary'}>
                    {c.kind === 'SERVICE' ? t('categoryService') : t('categoryProduct')}
                  </Badge>
                  {c.createdById && <Badge variant="accent">{t('categorySellerAdded')}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.nameRw} · {c.nameFr} · {t('categoryListingCount', { count: c._count.listings })}
                </p>
              </div>
              <CategoryAdmin
                category={{
                  id: c.id,
                  nameEn: c.nameEn,
                  nameRw: c.nameRw,
                  nameFr: c.nameFr,
                  kind: c.kind,
                  listingCount: c._count.listings,
                  sellerAdded: Boolean(c.createdById),
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
