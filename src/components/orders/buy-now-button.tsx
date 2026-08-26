'use client';

import { useState } from 'react';
import { ShoppingBag, Lock, ShieldAlert, Loader2, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useSession } from '@/components/providers';
import { apiFetch } from '@/lib/admin-client';
import { formatRWF } from '@/lib/utils';

/**
 * One-tap escrow checkout (Section 6). One clear order-summary screen — item,
 * price, escrow protection, off-app warning — then Mobile Money.
 */
export function BuyNowButton({
  listingId,
  price,
  locale,
}: {
  listingId: string;
  price: number;
  locale: string;
}) {
  const t = useTranslations('orders');
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const user = useSession();
  const [open, setOpen] = useState(false);
  const [delivery, setDelivery] = useState('pickup');
  const [busy, setBusy] = useState(false);

  if (!user) {
    // Preserve the listing they were about to buy through sign-up (§5).
    return (
      <Button
        variant="accent"
        onClick={() => router.push(`/register?returnTo=${encodeURIComponent(pathname)}`)}
      >
        <ShoppingBag className="h-4 w-4" /> {t('buyNow')}
      </Button>
    );
  }

  async function buy() {
    setBusy(true);
    try {
      const { data } = await apiFetch<{ orderId: string }>('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, deliveryMethod: delivery }),
      });
      toast(t('orderPlaced'), 'success');
      router.push(`/orders/${data.orderId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent">
          <ShoppingBag className="h-4 w-4" /> {t('buyNow')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('orderSummary')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
            <span className="text-sm text-muted-foreground">{t('youPay')}</span>
            <span className="text-xl font-extrabold text-primary">{formatRWF(price, locale)}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="delivery">{t('deliveryMethod')}</Label>
            <Select id="delivery" value={delivery} onChange={(e) => setDelivery(e.target.value)}>
              <option value="pickup">{t('pickup')}</option>
              <option value="delivery">{t('delivery')}</option>
            </Select>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-secondary/40 p-3 text-sm">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>{t('escrowNote')}</p>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>{t('offAppWarning')}</p>
          </div>

          <Button onClick={buy} disabled={busy} size="lg" className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
            {t('payWithMomo', { amount: formatRWF(price, locale) })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
