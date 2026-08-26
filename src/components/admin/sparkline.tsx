/** Tiny inline-SVG sparkline (no client JS) for dashboard trend cards. */
export function Sparkline({
  data,
  className,
  stroke = 'hsl(var(--primary))',
}: {
  data: number[];
  className?: string;
  stroke?: string;
}) {
  const w = 100;
  const h = 28;
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');
  const area = `0,${h} ${points} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <polygon points={area} fill={stroke} opacity="0.12" />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** ▲/▼ trend indicator vs. a previous period. */
export function Trend({ current, previous, label }: { current: number; previous: number; label?: string }) {
  const delta = current - previous;
  const pct = previous > 0 ? Math.round((delta / previous) * 100) : current > 0 ? 100 : 0;
  const up = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        up ? 'text-success' : 'text-destructive'
      }`}
    >
      {up ? '▲' : '▼'} {Math.abs(pct)}%{label ? ` ${label}` : ''}
    </span>
  );
}
