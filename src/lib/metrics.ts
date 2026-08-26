/**
 * Lightweight in-process request metrics for the admin System Health card.
 * A rolling window of recent request latencies + an error counter give real
 * p50/p95 latency and error-rate figures with no external dependency. In
 * production these would be corroborated by Sentry / the platform's APM; this
 * gives an always-available baseline even before Sentry is wired.
 */
const WINDOW = 500; // keep the last N request samples

type Sample = { ms: number; error: boolean };

const globalForMetrics = globalThis as unknown as { __isokoMetrics?: Sample[] };
const samples: Sample[] = globalForMetrics.__isokoMetrics ?? [];
if (process.env.NODE_ENV !== 'production') globalForMetrics.__isokoMetrics = samples;

export function recordRequest(ms: number, error: boolean): void {
  samples.push({ ms, error });
  if (samples.length > WINDOW) samples.shift();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]!);
}

export type HealthMetrics = {
  requests: number;
  errorRate: number; // 0..1
  p50: number; // ms
  p95: number; // ms
};

export function getHealth(): HealthMetrics {
  const durations = samples.map((s) => s.ms).sort((a, b) => a - b);
  const errors = samples.reduce((n, s) => n + (s.error ? 1 : 0), 0);
  return {
    requests: samples.length,
    errorRate: samples.length ? errors / samples.length : 0,
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
  };
}
