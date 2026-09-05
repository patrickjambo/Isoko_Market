'use client';

import { Package, Wrench, LayoutGrid } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/**
 * All · Products · Services segmented toggle — the primary browse split for the
 * marketplace. Preserves the other active filters and resets pagination.
 */
export function KindTabs({
  current,
  params,
}: {
  current?: string;
  params: Record<string, string | undefined>;
}) {
  const t = useTranslations('marketplace');
  const tc = useTranslations('common');
  const router = useRouter();

  // Category and condition are kind-specific, so switching tab clears them —
  // otherwise a product category carried onto the Services tab matches nothing.
  const DROP = new Set(['kind', 'page', 'categoryId', 'condition']);
  const go = (kind?: string) => {
    const sp = new URLSearchParams(
      Object.entries(params).filter(([k, v]) => v && !DROP.has(k)) as [string, string][]
    );
    if (kind) sp.set('kind', kind);
    const qs = sp.toString();
    router.push(`/marketplace${qs ? `?${qs}` : ''}`);
  };

  const tabs = [
    { key: undefined, label: tc('all'), icon: LayoutGrid },
    { key: 'PRODUCT', label: t('products'), icon: Package },
    { key: 'SERVICE', label: t('services'), icon: Wrench },
  ];

  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1">
      {tabs.map((tab) => {
        const active = (current ?? undefined) === tab.key;
        const Icon = tab.icon;
        return (
          <button
            key={tab.label}
            type="button"
            onClick={() => go(tab.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
