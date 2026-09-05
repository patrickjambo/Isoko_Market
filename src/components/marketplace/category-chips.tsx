import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * Horizontally scrollable category chips above the feed (Section 8.3). Plain
 * links so they work without client JS and stay light on low-end devices.
 */
export function CategoryChips({
  categories,
  current,
  params,
}: {
  categories: { id: string; name: string }[];
  current?: string;
  params: Record<string, string | undefined>;
}) {
  const t = useTranslations('common');

  const hrefFor = (categoryId?: string) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.view) sp.set('view', params.view);
    if (params.sort) sp.set('sort', params.sort);
    if (params.kind) sp.set('kind', params.kind); // keep the Products/Services tab selected
    if (categoryId) sp.set('categoryId', categoryId);
    const qs = sp.toString();
    return qs ? `/marketplace?${qs}` : '/marketplace';
  };

  const chip = (active: boolean) =>
    cn(
      'shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'border-border bg-card text-muted-foreground hover:bg-secondary'
    );

  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Categories">
      <Link href={hrefFor()} className={chip(!current)} role="tab" aria-selected={!current}>
        {t('all')}
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={hrefFor(c.id)}
          className={chip(current === c.id)}
          role="tab"
          aria-selected={current === c.id}
        >
          {c.name}
        </Link>
      ))}
    </div>
  );
}
