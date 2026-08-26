import type { Category } from '@prisma/client';

/** Pick the category name for the active locale (categories are stored trilingually). */
export function categoryName(
  category: Pick<Category, 'nameRw' | 'nameEn' | 'nameFr'> | null | undefined,
  locale: string
): string {
  if (!category) return '';
  if (locale === 'rw') return category.nameRw;
  if (locale === 'fr') return category.nameFr;
  return category.nameEn;
}
