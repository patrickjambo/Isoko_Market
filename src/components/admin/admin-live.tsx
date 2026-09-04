'use client';

import { useToast } from '@/components/ui/toast';
import { useRealtime } from '@/hooks/use-realtime';
import { usePollRefresh } from '@/hooks/use-poll-refresh';
import { useRouter } from '@/i18n/routing';

/**
 * Keeps the admin dashboard live: any admin:* event (report.created,
 * verification.pending, transaction.completed, signup, listing.created) shows a
 * toast and refreshes the current view + sidebar badges — no reload. SSE is the
 * instant path; a visibility-aware poll is the serverless-safe fallback (the
 * admin bus can't cross Vercel instances), so counters/queues stay current
 * even when no event reaches this tab.
 */
export function AdminLive() {
  const router = useRouter();
  const { toast } = useToast();

  usePollRefresh(15000);

  useRealtime((event) => {
    if (event.type === 'admin_event') {
      // Only surface a toast for the items that need attention.
      if (event.name === 'report.created' || event.name === 'verification.pending') {
        toast(event.label, 'info');
      }
      router.refresh();
    }
  });

  return null;
}
