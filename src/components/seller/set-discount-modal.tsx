'use client';

import { useState } from 'react';
import { Tag, X, Loader2 } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { formatRWF } from '@/lib/utils';
import { useLocale } from 'next-intl';
import { discountPercent } from '@/lib/discount';

type Props = {
  listingId: string;
  price: number;
  discountPrice?: number | null;
  discountEndsAt?: string | null;
  open: boolean;
  onClose: () => void;
};

const PERCENTAGES = [5, 10, 20, 30] as const;
const DURATIONS: { label: string; hours: number | null }[] = [
  { label: '24 Hours', hours: 24 },
  { label: '3 Days', hours: 72 },
  { label: '7 Days', hours: 168 },
  { label: '14 Days', hours: 336 },
  { label: '30 Days', hours: 720 },
  { label: 'No expiry', hours: null },
];

export function SetDiscountModal({
  listingId,
  price,
  discountPrice: initDiscount,
  open,
  onClose,
}: Props) {
  const router = useRouter();
  const locale = useLocale();
  const { toast } = useToast();

  const [mode, setMode] = useState<'pct' | 'fixed'>('pct');
  const [pct, setPct] = useState<number | ''>(10);
  const [fixedPrice, setFixedPrice] = useState<number | ''>(initDiscount ?? '');
  const [durationHours, setDurationHours] = useState<number | null>(168);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const computedSale =
    mode === 'pct' && pct !== ''
      ? Math.round(price * (1 - pct / 100))
      : mode === 'fixed' && fixedPrice !== ''
        ? fixedPrice
        : null;

  const pctSaved = computedSale ? discountPercent(price, computedSale) : 0;
  const isValid =
    computedSale !== null && computedSale > 0 && computedSale < price;
  const hasActive = !!initDiscount;

  async function apply() {
    if (!isValid || computedSale === null) return;
    setBusy(true);
    try {
      const endsAt =
        durationHours !== null
          ? new Date(Date.now() + durationHours * 3_600_000).toISOString()
          : null;
      const res = await fetch(`/api/listings/${listingId}/discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discountPrice: computedSale, discountEndsAt: endsAt }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: { message?: string } };
        toast(j.error?.message ?? 'Failed to set discount.', 'error');
        return;
      }
      toast('Discount activated! 🏷️', 'success');
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: true }),
      });
      if (!res.ok) {
        toast('Failed to remove discount.', 'error');
        return;
      }
      toast('Discount removed.', 'success');
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Set Discount</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Regular price:{' '}
          <span className="font-semibold text-foreground">{formatRWF(price, locale)}</span>
        </p>

        {/* Mode toggle */}
        <div className="flex gap-2">
          {(['pct', 'fixed'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === m
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-secondary'
              }`}
            >
              {m === 'pct' ? '% Percentage' : 'Fixed price'}
            </button>
          ))}
        </div>

        {mode === 'pct' ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {PERCENTAGES.map((p) => (
                <button
                  key={p}
                  onClick={() => setPct(p)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    pct === p
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-secondary'
                  }`}
                >
                  -{p}%
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Custom:</span>
              <input
                type="number"
                min={1}
                max={99}
                value={pct === '' ? '' : pct}
                onChange={(e) =>
                  setPct(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-20 rounded-lg border border-input bg-background px-2 py-1 text-sm"
                placeholder="e.g. 15"
              />
              <span className="text-sm">%</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-muted-foreground">Sale price (RWF):</span>
            <input
              type="number"
              min={1}
              value={fixedPrice === '' ? '' : fixedPrice}
              onChange={(e) =>
                setFixedPrice(e.target.value === '' ? '' : Number(e.target.value))
              }
              className="flex-1 rounded-lg border border-input bg-background px-2 py-1 text-sm"
              placeholder={String(Math.round(price * 0.8))}
            />
          </div>
        )}

        {/* Duration */}
        <div>
          <p className="mb-2 text-sm font-medium">Duration</p>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.label}
                onClick={() => setDurationHours(d.hours)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  durationHours === d.hours
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-secondary'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {isValid && computedSale !== null && (
          <div className="space-y-1 rounded-xl bg-secondary/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Regular</span>
              <span className="text-muted-foreground line-through">
                {formatRWF(price, locale)}
              </span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Sale price</span>
              <span className="text-primary">{formatRWF(computedSale, locale)}</span>
            </div>
            <div className="flex justify-between text-xs font-medium text-destructive">
              <span>Saving</span>
              <span>-{pctSaved}%</span>
            </div>
          </div>
        )}
        {computedSale !== null && computedSale >= price && (
          <p className="text-xs text-destructive">
            Discount price must be less than the regular price.
          </p>
        )}

        <div className="flex gap-2">
          {hasActive && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={clear}
              className="flex-1"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove Discount'}
            </Button>
          )}
          <Button size="sm" disabled={!isValid || busy} onClick={apply} className="flex-1">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Activate Sale'}
          </Button>
        </div>
      </div>
    </div>
  );
}
