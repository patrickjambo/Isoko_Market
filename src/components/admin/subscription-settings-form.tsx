'use client';

import { useState, useTransition } from 'react';
import {
  Crown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Phone,
  Zap,
  Lock,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { broadcastSubscriptionSettingsChange } from '@/components/providers/subscription-provider';

export type SubscriptionSettings = {
  subscriptionEnabled: boolean;
  subscriptionMonthlyPrice: number;
  subscriptionAnnualPrice: number;
  subscriptionMomoNumber: string;
  subscriptionMomoKind: 'PHONE' | 'MOMO_CODE';
  subscriptionRequireOnPublish: boolean;
  subscriptionAutoExpireMonths: number;
  subscriptionAutoExpireListings: number;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function SubscriptionSettingsForm({ initial }: { initial: SubscriptionSettings }) {
  const t = useTranslations('subscription');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [_isPending, startTransition] = useTransition();

  const [settings, setSettings] = useState<SubscriptionSettings>(initial);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);

  async function save(patch: Partial<SubscriptionSettings>) {
    setError(null);
    setSaveState('saving');

    // Optimistic update
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);

    try {
      const res = await fetch('/api/admin/settings/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? tc('error'));

      setSettings(data.data);
      broadcastSubscriptionSettingsChange(data.data);
      setSaveState('saved');
      startTransition(() => router.refresh());
      setTimeout(() => setSaveState('idle'), 3000);
    } catch (err) {
      // Revert optimistic update
      setSettings(settings);
      setError(err instanceof Error ? err.message : tc('error'));
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 4000);
    }
  }

  const isEnabled = settings.subscriptionEnabled;
  const annualSaving =
    settings.subscriptionAnnualPrice < settings.subscriptionMonthlyPrice * 12;

  return (
    <div className="max-w-2xl space-y-6">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Master switch card */}
      <div
        className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-200 ${
          isEnabled
            ? 'border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30'
            : 'border-border bg-card'
        }`}
      >
        {/* Animated pulse when enabled */}
        {isEnabled && (
          <span className="absolute right-4 top-4 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
          </span>
        )}

        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors ${
              isEnabled ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-muted'
            }`}
          >
            <Crown
              className={`h-6 w-6 ${isEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
            />
          </div>

          <div className="min-w-0 flex-1">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{t('enableLabel')}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{t('enableDesc')}</p>
              </div>

              {/* Toggle */}
              <button
                role="switch"
                aria-checked={isEnabled}
                onClick={() => save({ subscriptionEnabled: !isEnabled })}
                disabled={saveState === 'saving'}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors focus:outline-none disabled:opacity-60 ${
                  isEnabled
                    ? 'border-amber-500 bg-amber-500'
                    : 'border-input bg-input'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Save indicator */}
        {saveState === 'saving' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </div>
        )}
        {saveState === 'saved' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-success">
            <CheckCircle2 className="h-3 w-3" />
            {t('saved')}
          </div>
        )}
      </div>

      {/* Pricing section */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold">Pricing</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="monthlyPrice">{t('monthlyPriceLabel')}</Label>
            <Input
              id="monthlyPrice"
              type="number"
              min="0"
              step="100"
              value={settings.subscriptionMonthlyPrice}
              onChange={(e) => setSettings((s) => ({ ...s, subscriptionMonthlyPrice: Number(e.target.value) || 0 }))}
              onBlur={() => save({ subscriptionMonthlyPrice: settings.subscriptionMonthlyPrice })}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="annualPrice">{t('annualPriceLabel')}</Label>
              {annualSaving && (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  {t('annualSavings')}
                </span>
              )}
            </div>
            <Input
              id="annualPrice"
              type="number"
              min="0"
              step="1000"
              value={settings.subscriptionAnnualPrice}
              onChange={(e) => setSettings((s) => ({ ...s, subscriptionAnnualPrice: Number(e.target.value) || 0 }))}
              onBlur={() => save({ subscriptionAnnualPrice: settings.subscriptionAnnualPrice })}
            />
          </div>
        </div>
      </div>

      {/* MoMo payment destination */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Phone className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold">{t('momoNumberLabel')}</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{t('momoNumberDesc')}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="momoKind">Type</Label>
            <Select
              id="momoKind"
              value={settings.subscriptionMomoKind}
              onChange={(e) => {
                const v = e.target.value as 'PHONE' | 'MOMO_CODE';
                setSettings((s) => ({ ...s, subscriptionMomoKind: v }));
                save({ subscriptionMomoKind: v });
              }}
            >
              <option value="PHONE">{t('momoKindPhone')}</option>
              <option value="MOMO_CODE">{t('momoKindCode')}</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="momoNumber">{t('momoNumberLabel')}</Label>
            <Input
              id="momoNumber"
              value={settings.subscriptionMomoNumber}
              placeholder={settings.subscriptionMomoKind === 'PHONE' ? '+2507…' : '123456'}
              onChange={(e) => setSettings((s) => ({ ...s, subscriptionMomoNumber: e.target.value }))}
              onBlur={() => save({ subscriptionMomoNumber: settings.subscriptionMomoNumber })}
            />
          </div>
        </div>
      </div>

      {/* Gates section */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-amber-500" />
          <h3 className="font-semibold">Enforcement gates</h3>
        </div>

        <div className="space-y-5">
          {/* Require on publish */}
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{t('requireOnPublishLabel')}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{t('requireOnPublishDesc')}</p>
            </div>
            <button
              role="switch"
              aria-checked={settings.subscriptionRequireOnPublish}
              onClick={() =>
                save({ subscriptionRequireOnPublish: !settings.subscriptionRequireOnPublish })
              }
              disabled={saveState === 'saving'}
              className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors focus:outline-none disabled:opacity-60 ${
                settings.subscriptionRequireOnPublish
                  ? 'border-amber-500 bg-amber-500'
                  : 'border-input bg-input'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  settings.subscriptionRequireOnPublish ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>

          <hr className="border-border" />

          {/* Auto-expire months */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <Label htmlFor="autoExpireMonths">{t('autoExpireMonthsLabel')}</Label>
              </div>
              <Input
                id="autoExpireMonths"
                type="number"
                min="0"
                value={settings.subscriptionAutoExpireMonths}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, subscriptionAutoExpireMonths: Number(e.target.value) || 0 }))
                }
                onBlur={() => save({ subscriptionAutoExpireMonths: settings.subscriptionAutoExpireMonths })}
              />
              <p className="text-xs text-muted-foreground">{t('autoExpireMonthsDesc')}</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <Label htmlFor="autoExpireListings">{t('autoExpireListingsLabel')}</Label>
              </div>
              <Input
                id="autoExpireListings"
                type="number"
                min="0"
                value={settings.subscriptionAutoExpireListings}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, subscriptionAutoExpireListings: Number(e.target.value) || 0 }))
                }
                onBlur={() => save({ subscriptionAutoExpireListings: settings.subscriptionAutoExpireListings })}
              />
              <p className="text-xs text-muted-foreground">{t('autoExpireListingsDesc')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
