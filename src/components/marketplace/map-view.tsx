import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { RWANDA_DISTRICT_POS } from '@/lib/rwanda';
import { cn } from '@/lib/utils';

/**
 * Dependency-free schematic district "map" (Section 3). Bubbles sized by the
 * number of active listings per district; tapping one filters the feed to that
 * area. District-level only — approximate, never an exact address.
 */
export function MapView({
  counts,
  params,
}: {
  counts: Record<string, number>;
  params: Record<string, string | undefined>;
}) {
  const t = useTranslations('marketplace');
  const max = Math.max(1, ...Object.values(counts));

  const hrefFor = (district: string) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set('q', params.q);
    if (params.categoryId) sp.set('categoryId', params.categoryId);
    sp.set('location', district);
    sp.set('view', 'map');
    return `/marketplace?${sp.toString()}`;
  };

  return (
    <div>
      <div className="relative mx-auto aspect-[4/3] w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-secondary/30">
        {RWANDA_DISTRICT_POS.map((d) => {
          const count = counts[d.name] ?? 0;
          const size = count === 0 ? 10 : 14 + Math.round((count / max) * 26);
          const active = params.location?.toLowerCase().includes(d.name.toLowerCase());
          return (
            <Link
              key={d.name}
              href={hrefFor(d.name)}
              title={`${d.name} · ${count}`}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${d.x}%`, top: `${d.y}%` }}
            >
              <span
                className={cn(
                  'flex items-center justify-center rounded-full text-[10px] font-bold transition-transform group-hover:scale-110',
                  count === 0
                    ? 'bg-muted-foreground/20 text-transparent'
                    : active
                      ? 'bg-accent text-accent-foreground ring-2 ring-accent'
                      : 'bg-primary text-primary-foreground'
                )}
                style={{ width: size, height: size }}
              >
                {count > 0 ? count : ''}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">{t('mapNote')}</p>

      {params.location && (
        <div className="mt-3 text-center">
          <Link href="/marketplace?view=map" className="text-sm font-medium text-primary hover:underline">
            {t('clearLocation')} · {params.location}
          </Link>
        </div>
      )}
    </div>
  );
}
