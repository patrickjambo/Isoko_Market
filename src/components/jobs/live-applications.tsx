'use client';

import { useRouter } from '@/i18n/routing';
import { useRealtime } from '@/hooks/use-realtime';
import { usePollRefresh } from '@/hooks/use-poll-refresh';

/**
 * Live-refreshes the seeker's Applications panel the moment an employer moves
 * them (shortlisted/interview/hired/…), so the status change lands in real time
 * — not just on next page load (spec Part 8 / DoD #5).
 *
 * Two layers: instant SSE when the transport reaches this client, plus a polling
 * fallback that works on serverless (Vercel), where the in-memory SSE bus can't
 * cross function instances — so the employer's action still shows up on its own,
 * with no manual refresh.
 */
export function LiveApplications() {
  const router = useRouter();
  useRealtime((event) => {
    if (event.type === 'application_update') router.refresh();
  });
  usePollRefresh(5000);
  return null;
}
