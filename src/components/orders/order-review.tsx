'use client';

import { useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { apiFetch } from '@/lib/admin-client';
import { cn } from '@/lib/utils';

/** Post-completion review — feeds the seller's public rating instantly (Section 7). */
export function OrderReview({ orderId }: { orderId: string }) {
  const t = useTranslations('orders');
  const router = useRouter();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (rating < 1) return;
    setBusy(true);
    try {
      await apiFetch(`/api/orders/${orderId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });
      toast(t('reviewThanks'), 'success');
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 font-semibold">{t('rateSeller')}</p>
      <div className="mb-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(i)}
            aria-label={`${i}`}
          >
            <Star
              className={cn(
                'h-8 w-8 transition-colors',
                (hover || rating) >= i ? 'fill-accent text-accent' : 'fill-transparent text-muted-foreground/40'
              )}
            />
          </button>
        ))}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder={t('reviewPlaceholder')} />
      <Button className="mt-3" onClick={submit} disabled={busy || rating < 1}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('submitReview')}
      </Button>
    </div>
  );
}
