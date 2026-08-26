'use client';

import { LayoutGrid, List, Map } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';

type View = 'grid' | 'list' | 'map';

/** Grid / list / map view toggle for the marketplace feed (Section 8.3 / 3). */
export function ViewToggle({
  view,
  params,
}: {
  view: View;
  params: Record<string, string | undefined>;
}) {
  const t = useTranslations('marketplace');
  const router = useRouter();

  function set(next: View) {
    const sp = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][]
    );
    if (next === 'grid') sp.delete('view');
    else sp.set('view', next);
    router.push(`/marketplace?${sp.toString()}`);
  }

  const opts: { key: View; icon: LucideIcon; label: string }[] = [
    { key: 'grid', icon: LayoutGrid, label: t('gridView') },
    { key: 'list', icon: List, label: t('listView') },
    { key: 'map', icon: Map, label: t('mapView') },
  ];

  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-input" role="group">
      {opts.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.key}
            onClick={() => set(o.key)}
            aria-label={o.label}
            aria-pressed={view === o.key}
            className={cn(
              'flex h-11 w-11 items-center justify-center border-l border-input first:border-l-0',
              view === o.key ? 'bg-secondary text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
          </button>
        );
      })}
    </div>
  );
}
