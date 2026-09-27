'use client';

import { useState } from 'react';
import { Lock, Unlock, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/**
 * Close / reopen a job from the admin Jobs table. Closing takes it off the
 * public board; the record and its applications are preserved.
 */
export function JobActions({ jobId, status }: { jobId: string; status: 'OPEN' | 'CLOSED' }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const next = status === 'OPEN' ? 'CLOSED' : 'OPEN';

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      toast(next === 'CLOSED' ? t('jobClosed') : t('jobReopened'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={toggle}
      disabled={loading}
      className={status === 'OPEN' ? 'text-destructive hover:text-destructive' : ''}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : status === 'OPEN' ? (
        <Lock className="h-4 w-4" />
      ) : (
        <Unlock className="h-4 w-4" />
      )}
      {status === 'OPEN' ? t('closeJob') : t('reopenJob')}
    </Button>
  );
}
