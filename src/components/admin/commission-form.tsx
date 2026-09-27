'use client';

import { useState } from 'react';
import { Loader2, Percent, Coins } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { formatRWF } from '@/lib/utils';

export type CommissionSettings = {
  commissionEnabled: boolean;
  commissionType: 'PERCENT' | 'FIXED';
  commissionPercent: number;
  commissionFixed: number; // minor units
  commissionMin: number;
  commissionMax: number;
  payoutKind: 'PHONE' | 'MOMO_CODE';
  payoutValue: string;
  chargingStartsAt: string | null; // ISO
  freePeriodDays: number;
};

/** minor units (centimes) ↔ whole RWF for the form fields. */
const toRwf = (minor: number) => Math.round(minor / 100);
const toMinor = (rwf: number) => Math.round(rwf * 100);
const toLocalInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

export function CommissionForm({ initial }: { initial: CommissionSettings }) {
  const t = useTranslations('commission');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();

  const [enabled, setEnabled] = useState(initial.commissionEnabled);
  const [type, setType] = useState(initial.commissionType);
  const [percent, setPercent] = useState(String(initial.commissionPercent));
  const [fixed, setFixed] = useState(String(toRwf(initial.commissionFixed)));
  const [min, setMin] = useState(String(toRwf(initial.commissionMin)));
  const [max, setMax] = useState(String(toRwf(initial.commissionMax)));
  const [payoutKind, setPayoutKind] = useState(initial.payoutKind);
  const [payoutValue, setPayoutValue] = useState(initial.payoutValue);
  const [startsAt, setStartsAt] = useState(toLocalInput(initial.chargingStartsAt));
  const [freeDays, setFreeDays] = useState(String(initial.freePeriodDays));
  const [sample, setSample] = useState('10000');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview of the fee on a sample sale (assumes charging is active).
  const sampleMinor = toMinor(Number(sample) || 0);
  let previewFee =
    type === 'PERCENT' ? Math.round(sampleMinor * (Number(percent) || 0) / 100) : toMinor(Number(fixed) || 0);
  const minM = toMinor(Number(min) || 0);
  const maxM = toMinor(Number(max) || 0);
  if (minM > 0) previewFee = Math.max(previewFee, minM);
  if (maxM > 0) previewFee = Math.min(previewFee, maxM);
  previewFee = Math.max(0, Math.min(previewFee, sampleMinor));
  const sellerNet = sampleMinor - previewFee;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (enabled && !payoutValue.trim()) return setError(t('errDestination'));
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings/commission', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commissionEnabled: enabled,
          commissionType: type,
          commissionPercent: Number(percent) || 0,
          commissionFixed: toMinor(Number(fixed) || 0),
          commissionMin: toMinor(Number(min) || 0),
          commissionMax: toMinor(Number(max) || 0),
          payoutKind,
          payoutValue: payoutValue.trim(),
          chargingStartsAt: startsAt ? new Date(startsAt).toISOString() : null,
          freePeriodDays: Number(freeDays) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? tc('error'));
      toast(t('saved'), 'success');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : tc('error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={save} className="max-w-xl space-y-6">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Master switch */}
      <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <span>
          <span className="font-semibold">{t('enableTitle')}</span>
          <span className="block text-sm text-muted-foreground">{t('enableHint')}</span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-5 w-5 accent-[hsl(var(--primary))]"
        />
      </label>

      <fieldset className="space-y-4" disabled={!enabled}>
        {/* Rate */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('typeLabel')}</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as 'PERCENT' | 'FIXED')}>
              <option value="PERCENT">{t('typePercent')}</option>
              <option value="FIXED">{t('typeFixed')}</option>
            </Select>
          </div>
          {type === 'PERCENT' ? (
            <div className="space-y-1.5">
              <Label htmlFor="percent">{t('percentLabel')}</Label>
              <div className="relative">
                <Input id="percent" type="number" step="0.1" min="0" max="100" value={percent} onChange={(e) => setPercent(e.target.value)} />
                <Percent className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="fixed">{t('fixedLabel')}</Label>
              <Input id="fixed" type="number" min="0" value={fixed} onChange={(e) => setFixed(e.target.value)} />
            </div>
          )}
        </div>

        {type === 'PERCENT' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="min">{t('minLabel')}</Label>
              <Input id="min" type="number" min="0" value={min} onChange={(e) => setMin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max">{t('maxLabel')}</Label>
              <Input id="max" type="number" min="0" value={max} onChange={(e) => setMax(e.target.value)} />
            </div>
          </div>
        )}

        {/* Destination */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('destKindLabel')}</Label>
            <Select value={payoutKind} onChange={(e) => setPayoutKind(e.target.value as 'PHONE' | 'MOMO_CODE')}>
              <option value="PHONE">{t('destPhone')}</option>
              <option value="MOMO_CODE">{t('destCode')}</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payoutValue">{t('destValueLabel')}</Label>
            <Input id="payoutValue" value={payoutValue} onChange={(e) => setPayoutValue(e.target.value)} placeholder={payoutKind === 'PHONE' ? '+2507…' : '123456'} />
          </div>
        </div>

        {/* When charging starts + free period */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="startsAt">{t('startsAtLabel')}</Label>
            <Input id="startsAt" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t('startsAtHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="freeDays">{t('freeDaysLabel')}</Label>
            <Input id="freeDays" type="number" min="0" value={freeDays} onChange={(e) => setFreeDays(e.target.value)} />
            <div className="flex gap-2">
              {[
                { d: '0', k: 'freeNone' },
                { d: '30', k: 'freeMonth' },
                { d: '365', k: 'freeYear' },
              ].map((o) => (
                <button
                  key={o.d}
                  type="button"
                  onClick={() => setFreeDays(o.d)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-secondary"
                >
                  {t(o.k)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Coins className="h-4 w-4 text-primary" /> {t('previewTitle')}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="sample" className="text-sm">{t('previewSale')}</Label>
            <Input id="sample" type="number" min="0" value={sample} onChange={(e) => setSample(e.target.value)} className="h-8 w-32" />
          </div>
          <p className="mt-2 text-sm">
            {t('previewFee')}: <strong>{formatRWF(previewFee)}</strong> · {t('previewSeller')}:{' '}
            <strong>{formatRWF(sellerNet)}</strong>
          </p>
        </div>
      </fieldset>

      <Button type="submit" size="lg" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('save')}
      </Button>
    </form>
  );
}
