'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Rocket, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
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
            icon={Rocket}
            variant="outline"
          />
        ))}
    </div>
  );
}
