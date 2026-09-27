'use client';

import { useState } from 'react';
import { CheckCircle2, Lock, RotateCcw, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

type Status = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
type Priority = 'LOW' | 'NORMAL' | 'HIGH';

/**
 * Ticket management. Staff (canManage) get resolve/close/reopen + a priority
 * selector; the ticket owner gets a single "Close ticket" action.
 */
export function TicketControls({
  ticketId,
  status,
  priority,
  canManage,
}: {
  ticketId: string;
  status: Status;
  priority: Priority;
  canManage: boolean;
}) {
  const t = useTranslations('support');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function patch(payload: { status?: Status; priority?: Priority }) {
    setLoading(true);
    try {
      const res = await fetch(`/api/support/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? tc('error'));
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('error'), 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!canManage) {
    if (status === 'CLOSED') return null;
    return (
      <Button variant="outline" size="sm" disabled={loading} onClick={() => patch({ status: 'CLOSED' })}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {t('closeTicket')}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={priority}
        disabled={loading}
        onChange={(e) => patch({ priority: e.target.value as Priority })}
        className="h-9 w-[130px] text-sm"
        aria-label={t('priorityLabel')}
      >
        <option value="LOW">{t('priority_LOW')}</option>
        <option value="NORMAL">{t('priority_NORMAL')}</option>
        <option value="HIGH">{t('priority_HIGH')}</option>
      </Select>

      {status !== 'RESOLVED' && status !== 'CLOSED' && (
        <Button variant="outline" size="sm" disabled={loading} onClick={() => patch({ status: 'RESOLVED' })}>
          <CheckCircle2 className="h-4 w-4" /> {t('resolve')}
        </Button>
      )}
      {(status === 'RESOLVED' || status === 'CLOSED') && (
        <Button variant="outline" size="sm" disabled={loading} onClick={() => patch({ status: 'OPEN' })}>
          <RotateCcw className="h-4 w-4" /> {t('reopen')}
        </Button>
      )}
      {status !== 'CLOSED' && (
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => patch({ status: 'CLOSED' })}
          className="text-destructive hover:text-destructive"
        >
          <Lock className="h-4 w-4" /> {t('close')}
        </Button>
      )}
    </div>
  );
}
