import 'server-only';

/**
 * Run best-effort side-effect work (transaction emails, notifications, analytics
 * pings) AFTER the HTTP response, without blocking it — the Vercel-native
 * alternative to a Celery/RabbitMQ worker for short tasks.
 *
 * The catch: a bare un-awaited promise in a Serverless Function is KILLED the
 * moment the response is sent, so "fire and forget" emails silently never send in
 * production. `waitUntil` keeps the function alive until the work finishes. Off
 * Vercel (local dev, `next start`) the long-running server completes it anyway,
 * so we just let the promise run. Errors are swallowed + logged — background work
 * must never surface to the user or fail the request.
 */
export function background(work: () => Promise<unknown>): void {
  const p = Promise.resolve()
    .then(work)
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[background]', err instanceof Error ? err.message : err);
    });

  if (process.env.VERCEL) {
    void import('@vercel/functions')
      .then(({ waitUntil }) => waitUntil(p))
      .catch(() => {
        /* not on a Vercel function runtime — the promise still runs */
      });
  }
}
