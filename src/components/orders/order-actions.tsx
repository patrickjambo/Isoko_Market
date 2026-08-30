'use client';

import { useState } from 'react';
import { CheckCircle2, PackageCheck, Ban, Flag, Loader2, Send } from 'lucide-react';
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
import { ImageUploader } from '@/components/shared/image-uploader';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/admin-client';

/** Role- and status-aware actions for the manual P2P order flow (Section 7). */
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
  const [proof, setProof] = useState<string[]>([]);

  async function act(action: string, extra?: Record<string, unknown>) {
    setBusy(action);
    try {
      await apiFetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
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
    <div className="space-y-3">
      {/* Buyer: confirm they've sent the money (with an optional proof screenshot). */}
      {role === 'buyer' && status === 'PENDING_PAYMENT' && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t('proofLabel')}</p>
            <p className="text-xs text-muted-foreground">{t('proofHint')}</p>
            <ImageUploader value={proof} onChange={setProof} max={1} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => act('mark_paid', { proofUrl: proof[0] })} disabled={busy !== null}>
              {busy === 'mark_paid' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t('markPaid')}
            </Button>
            <Button variant="outline" onClick={() => act('cancel')} disabled={busy !== null}>
              {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Seller: confirm the payment actually arrived in their MoMo/Airtel app. */}
        {role === 'seller' && status === 'BUYER_MARKED_PAID' && (
          <Button onClick={() => act('confirm')} disabled={busy !== null}>
            {busy === 'confirm' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {t('confirmPaymentReceived')}
          </Button>
        )}

        {/* Buyer: confirm they received the item → completes + unlocks the review. */}
        {role === 'buyer' && status === 'SELLER_CONFIRMED' && (
          <Button variant="accent" onClick={() => act('receive')} disabled={busy !== null}>
            {busy === 'receive' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            {t('confirmReceipt')}
          </Button>
        )}

        {!done && status !== 'DISPUTED' && (
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => setDisputeOpen(true)}
            disabled={busy !== null}
          >
            <Flag className="h-4 w-4" /> {t('reportProblem')}
          </Button>
        )}
      </div>

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reportProblem')}</DialogTitle>
            <DialogDescription>{t('disputeHint')}</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={t('disputePlaceholder')} />
          <Button variant="destructive" onClick={() => act('dispute', { reason })} disabled={busy !== null}>
            {busy === 'dispute' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('openDispute')}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
