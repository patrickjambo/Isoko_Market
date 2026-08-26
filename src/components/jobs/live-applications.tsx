'use client';

import { useRouter } from '@/i18n/routing';
import { useRealtime } from '@/hooks/use-realtime';

/**
 * Live-refreshes the seeker's Applications panel the moment an employer moves
 * them (shortlisted/interview/hired/…), so the status change lands in real time
 * — not just on next page load (spec Part 8 / DoD #5). The persisted
 * notification + bell already fire; this keeps the panel itself in sync.
 */
export function LiveApplications() {
  const router = useRouter();
  useRealtime((event) => {
    if (event.type === 'application_update') router.refresh();
  });
  return null;
}
