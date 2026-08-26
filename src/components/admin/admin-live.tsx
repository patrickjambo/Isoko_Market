'use client';

import { useRouter } from '@/i18n/routing';
import { useToast } from '@/components/ui/toast';
import { useRealtime } from '@/hooks/use-realtime';

/**
 * Keeps the admin dashboard live: any admin:* event (report.created,
 * verification.pending, transaction.completed, signup, listing.created) shows a
 * toast and refreshes the current view + sidebar badges — no reload.
 */
export function AdminLive() {
  const router = useRouter();
  const { toast } = useToast();

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
