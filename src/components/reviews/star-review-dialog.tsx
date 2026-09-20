'use client';

import { useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

/**
 * Star + comment review, posted to `endpoint`. Reused wherever a review is left
 * (e.g. a completed service request). The server recomputes the listing's rating,
 * so stars update everywhere on refresh.
 */
export function StarReviewDialog({
  endpoint,
  triggerLabel,
  title,
}: {
  endpoint: string;
  triggerLabel: string;
  title: string;
}) {
  const t = useTranslations('orders');
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (rating < 1) return;
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error?.message ?? 'error');
      toast(t('reviewThanks'), 'success');
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Star className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1">
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
                  (hover || rating) >= i
                    ? 'fill-accent text-accent'
                    : 'fill-transparent text-muted-foreground/40'
                )}
              />
            </button>
          ))}
        </div>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder={t('reviewPlaceholder')}
        />
        <Button onClick={submit} disabled={busy || rating < 1}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t('submitReview')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
