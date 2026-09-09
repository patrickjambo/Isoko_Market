'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Star, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { PaymentButton } from '@/components/payments/payment-button';
import { PRICING, FEATURE_DURATION_DAYS } from '@/lib/pricing';

/**
 * Seller-only controls on their own listing — "mark as sold" plus the paid
 * "boost/featured" premium feature (Section 6.2).
 */
export function ListingOwnerActions({
  listingId,
  status,
  isFeatured,
}: {
  listingId: string;
  status: string;
  isFeatured: boolean;
}) {
  const t = useTranslations('marketplace');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/listings/${listingId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast(tc('deleted'), 'success');
      setConfirmOpen(false);
      router.push('/dashboard/listings');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
      setDeleting(false);
    }
  }

  async function setStatus(next: 'SOLD' | 'ACTIVE') {
    setLoading(true);
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      toast(next === 'SOLD' ? t('sold') : t('title'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild>
        <Link href={`/marketplace/${listingId}/edit`}>
          <Pencil className="h-4 w-4" /> {tc('edit')}
        </Link>
      </Button>

      {status === 'SOLD' ? (
        <Button variant="outline" onClick={() => setStatus('ACTIVE')} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('title')}
        </Button>
      ) : (
        <Button variant="accent" onClick={() => setStatus('SOLD')} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {t('markAsSold')}
        </Button>
      )}

      {status === 'ACTIVE' &&
        (isFeatured ? (
          <Badge variant="accent" className="h-11 px-4">
            <Star className="h-4 w-4" /> {t('featured')}
          </Badge>
        ) : (
          <PaymentButton
            type="FEATURED_LISTING"
            amount={PRICING.FEATURED_LISTING}
            metadata={{ listingId }}
            label={t('boostListing')}
            title={t('boostListing')}
            description={t('boostBody', { days: FEATURE_DURATION_DAYS })}
            icon="rocket"
            variant="outline"
          />
        ))}

      {/* Delete — behind a confirm dialog so it can't happen by accident. */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" /> {tc('delete')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('deleteConfirmBody')}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1" disabled={deleting}>
                {tc('cancel')}
              </Button>
            </DialogClose>
            <Button variant="destructive" className="flex-1" onClick={remove} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {tc('delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
