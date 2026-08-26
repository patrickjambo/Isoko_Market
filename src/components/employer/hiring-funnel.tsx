import { useTranslations } from 'next-intl';

/**
 * Per-job mini funnel (§2/§6): Applied → Shortlisted → Hired as a compact
 * proportional bar — visual, not a raw table, so a repeat employer can scan
 * several open roles at a glance.
 */
export function HiringFunnel({
  applied,
  shortlisted,
  hired,
}: {
  applied: number;
  shortlisted: number;
  hired: number;
}) {
  const t = useTranslations('employer');
  const max = Math.max(applied, 1);
  const stages: [string, number, string][] = [
    [t('funnelApplied'), applied, 'bg-secondary'],
    [t('funnelShortlisted'), shortlisted, 'bg-accent/60'],
    [t('funnelHired'), hired, 'bg-success'],
  ];

  return (
    <div className="flex items-center gap-2" aria-label={t('hiringProgress')}>
      {stages.map(([label, value, color]) => (
        <div key={label} className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline justify-between gap-1">
            <span className="truncate text-[11px] text-muted-foreground">{label}</span>
            <span className="text-xs font-bold">{value}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
