'use client';

import { useState } from 'react';
import { Loader2, UserCheck, Store } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/**
 * Arbitration controls for a disputed order: an optional decision note, then
 * "resolve for buyer" (cancel + relist) or "resolve for seller" (complete).
 */
export function DisputeResolve({ orderId }: { orderId: string }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState<'BUYER' | 'SELLER' | null>(null);

  async function resolve(resolution: 'BUYER' | 'SELLER') {
    setLoading(resolution);
    try {
      const res = await fetch(`/api/admin/disputes/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? tc('error'));
      toast(t('disputeResolved'), 'success');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('error'), 'error');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="font-semibold">{t('resolveDispute')}</h3>
        <p className="text-sm text-muted-foreground">{t('resolveDisputeHint')}</p>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={t('decisionNotePlaceholder')}
        className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={loading !== null} onClick={() => resolve('BUYER')}>
          {loading === 'BUYER' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
          {t('favourBuyer')}
        </Button>
        <Button variant="outline" disabled={loading !== null} onClick={() => resolve('SELLER')}>
          {loading === 'SELLER' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
          {t('favourSeller')}
        </Button>
      </div>
    </div>
  );
}
