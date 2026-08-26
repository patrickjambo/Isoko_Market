'use client';

import { useState } from 'react';
import { CheckCircle2, PackageCheck, Ban, Flag, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/admin-client';

/** Role- and status-aware order actions (Section 7). */
export function OrderActions({
  orderId,
  status,
  role,
}: {
  orderId: string;
  status: string;
  role: 'buyer' | 'seller';
}) {
  const t = useTranslations('orders');
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState('');

  async function act(action: string, reasonText?: string) {
    setBusy(action);
    try {
      await apiFetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: reasonText }),
      });
      toast(t('updated'), 'success');
      setDisputeOpen(false);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setBusy(null);
    }
  }

  const done = status === 'COMPLETED' || status === 'CANCELLED';

  return (
    <div className="flex flex-wrap gap-2">
      {role === 'seller' && status === 'PAYMENT_SENT' && (
        <Button onClick={() => act('confirm')} disabled={busy !== null}>
          {busy === 'confirm' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {t('confirmHandover')}
        </Button>
      )}

      {role === 'buyer' && (status === 'PAYMENT_SENT' || status === 'SELLER_CONFIRMED') && (
        <Button variant="accent" onClick={() => act('receive')} disabled={busy !== null}>
          {busy === 'receive' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
          {t('confirmReceipt')}
        </Button>
      )}

      {role === 'buyer' && status === 'PAYMENT_SENT' && (
        <Button variant="outline" onClick={() => act('cancel')} disabled={busy !== null}>
          {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
          {t('cancel')}
        </Button>
      )}

      {!done && status !== 'DISPUTED' && (
        <Button variant="ghost" className="text-destructive" onClick={() => setDisputeOpen(true)} disabled={busy !== null}>
          <Flag className="h-4 w-4" /> {t('reportProblem')}
        </Button>
      )}

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reportProblem')}</DialogTitle>
            <DialogDescription>{t('disputeHint')}</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={t('disputePlaceholder')} />
          <Button variant="destructive" onClick={() => act('dispute', reason)} disabled={busy !== null}>
            {busy === 'dispute' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('openDispute')}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
