'use client';

import { useState } from 'react';
import { MoreVertical, Pencil, Pause, Play, CheckCircle2, Rocket, Trash2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
import { PRICING, FEATURE_DURATION_DAYS } from '@/lib/pricing';

/** Inline quick actions per listing (Section 6) — no separate page needed. */
export function SellerListingActions({
  listingId,
  status,
  isFeatured,
}: {
  listingId: string;
  status: string;
  isFeatured: boolean;
}) {
  const t = useTranslations('seller');
  const tm = useTranslations('marketplace');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function patch(next: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      toast(t('updated'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/listings/${listingId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast(t('deleted'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function boost() {
    setBusy(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'FEATURED_LISTING',
          amount: PRICING.FEATURED_LISTING,
          provider: 'mock',
          metadata: { listingId },
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message);
      toast(j.result?.status === 'SUCCESS' ? tm('featured') : t('updated'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary" aria-label={t('actions')}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/marketplace/${listingId}`}>
            <Pencil /> {t('edit')}
          </Link>
        </DropdownMenuItem>

        {status === 'ACTIVE' && (
          <>
            {!isFeatured && (
              <DropdownMenuItem onSelect={boost}>
                <Rocket className="text-accent" /> {t('boostDays', { days: FEATURE_DURATION_DAYS })}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => patch('PAUSED')}>
              <Pause /> {t('pause')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => patch('SOLD')}>
              <CheckCircle2 /> {tm('markAsSold')}
            </DropdownMenuItem>
          </>
        )}

        {(status === 'PAUSED' || status === 'SOLD') && (
          <DropdownMenuItem onSelect={() => patch('ACTIVE')}>
            <Play /> {t('relist')}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={remove} className="text-destructive focus:text-destructive">
          <Trash2 /> {t('delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
