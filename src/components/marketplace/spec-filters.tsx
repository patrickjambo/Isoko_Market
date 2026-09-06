'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import type { SpecFacet } from '@/lib/queries';

/**
 * Category-scoped spec facets (e.g. RAM / Storage for phones, Year / Fuel for
 * cars). Only rendered when a category is selected, and built from that
 * category's real listings — so buyers filter by the features that actually
 * matter for THAT kind of product. One value per feature; AND across features.
 */
export function SpecFilters({
  facets,
  params,
}: {
  facets: SpecFacet[];
  params: Record<string, string | undefined>;
}) {
  const t = useTranslations('marketplace');
  const router = useRouter();

  // Current selection: label -> value.
  const selected = new Map<string, string>();
  try {
    const parsed = params.specs ? (JSON.parse(params.specs) as unknown[]) : [];
    for (const p of parsed) {
      if (Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string') {
        selected.set(p[0], p[1]);
      }
    }
  } catch {
    /* ignore malformed */
  }

  function apply(next: Map<string, string>) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== 'specs' && k !== 'page') sp.set(k, v);
    }
    const pairs = [...next.entries()];
    if (pairs.length > 0) sp.set('specs', JSON.stringify(pairs));
    const qs = sp.toString();
    router.push(`/marketplace${qs ? `?${qs}` : ''}`);
  }

  function toggle(label: string, value: string) {
    const next = new Map(selected);
    if (next.get(label) === value) next.delete(label);
    else next.set(label, value);
    apply(next);
  }

  if (facets.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        {t('filterByFeatures')}
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => apply(new Map())}
            className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t('clearFeatures')}
          </button>
        )}
      </div>
      <div className="space-y-2.5">
        {facets.map((facet) => (
          <div key={facet.label}>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{facet.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {facet.values.map((value) => {
                const active = selected.get(facet.label) === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggle(facet.label, value)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-secondary'
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
