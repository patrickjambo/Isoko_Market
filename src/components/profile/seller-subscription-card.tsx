'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Crown,
  Clock,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { useSubscriptionSettings } from '@/components/providers/subscription-provider';
import { cn } from '@/lib/utils';

type SubscriptionStatus = 'NONE' | 'ACTIVE' | 'EXPIRED' | 'GRACE';
type SubscriptionPlan = 'MONTHLY' | 'ANNUAL';

interface Props {
  initialStatus: SubscriptionStatus;
  initialPlan: SubscriptionPlan | null;
  initialExpiresAt: string | null;
  phone: string | null;
  isSeller: boolean;
}

function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState<{ days: number; hours: number; minutes: number } | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(null);
      return;
    }

    function compute() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining({ days: 0, hours: 0, minutes: 0 });
        return;
      }
      const totalMinutes = Math.floor(diff / 60000);
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const minutes = totalMinutes % 60;
      setRemaining({ days, hours, minutes });
    }

    compute();
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

export function SellerSubscriptionCard({ initialStatus, initialPlan, initialExpiresAt, phone, isSeller }: Props) {
  const t = useTranslations('subscription');
  const { toast } = useToast();
  const settings = useSubscriptionSettings();

  // Local state — updated after successful payment without page refresh
  const [status, setStatus] = useState<SubscriptionStatus>(initialStatus);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(initialPlan);
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt);

  // Subscribe dialog state
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('MONTHLY');
  const [phoneValue, setPhoneValue] = useState(phone ?? '');
  const [submitting, setSubmitting] = useState(false);

  const countdown = useCountdown(status === 'ACTIVE' || status === 'GRACE' ? expiresAt : null);

  const handleSubscribe = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        const res = await fetch('/api/seller/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: selectedPlan, phone: phoneValue.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error?.message ?? 'Payment failed. Please try again.');
        }
        // Update local state so the card flips to ACTIVE immediately
        const newExpiresAt: string | null = data.subscriptionExpiresAt ?? null;
        setStatus('ACTIVE');
        setPlan(selectedPlan);
        setExpiresAt(newExpiresAt);
        setOpen(false);
        toast(t('statusActiveTitle'), 'success');
      } catch (err) {
        toast(err instanceof Error && err.message ? err.message : 'Payment failed. Please try again.', 'error');
      } finally {
        setSubmitting(false);
      }
    },
    [selectedPlan, phoneValue, t, toast]
  );

  // Guard: hide when disabled or not a seller
  if (!settings.subscriptionEnabled || !isSeller) return null;

  const selectedPrice =
    selectedPlan === 'MONTHLY'
      ? settings.subscriptionMonthlyPrice
      : settings.subscriptionAnnualPrice;

  // ── ACTIVE ──────────────────────────────────────────────────────────────────
  if (status === 'ACTIVE') {
    return (
      <section className="rounded-2xl border border-green-500/30 bg-green-500/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-green-500/15 text-green-600">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {t('statusActiveTitle')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {plan === 'MONTHLY' ? t('planMonthly') : t('planAnnual')}
                {expiresAt && (
                  <>
                    {' · '}
                    {t('expiresOn', {
                      date: new Date(expiresAt).toLocaleDateString(),
                    })}
                  </>
                )}
              </p>
              {countdown && (
                <p className="mt-1 text-xs font-medium text-green-600 dark:text-green-400">
                  {t('daysRemaining', { days: countdown.days, hours: countdown.hours })}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── GRACE ───────────────────────────────────────────────────────────────────
  if (status === 'GRACE') {
    return (
      <>
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  {t('statusGraceTitle')}
                </h2>
                <p className="text-sm text-muted-foreground">{t('graceDesc')}</p>
                {countdown && (
                  <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    {t('daysRemaining', { days: countdown.days, hours: countdown.hours })}
                  </p>
                )}
              </div>
            </div>
            <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
              {t('renewNow')}
            </Button>
          </div>
        </section>
        <SubscribeDialog
          open={open}
          onOpenChange={setOpen}
          selectedPlan={selectedPlan}
          onSelectPlan={setSelectedPlan}
          phoneValue={phoneValue}
          onPhoneChange={setPhoneValue}
          monthlyPrice={settings.subscriptionMonthlyPrice}
          annualPrice={settings.subscriptionAnnualPrice}
          selectedPrice={selectedPrice}
          submitting={submitting}
          onSubmit={handleSubscribe}
          t={t}
        />
      </>
    );
  }

  // ── EXPIRED ─────────────────────────────────────────────────────────────────
  if (status === 'EXPIRED') {
    return (
      <>
        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-destructive">
                  {t('statusExpiredTitle')}
                </h2>
                <p className="text-sm text-muted-foreground">{t('expiredDesc')}</p>
                {expiresAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('expiredOn', { date: new Date(expiresAt).toLocaleDateString() })}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              {t('renewNow')}
            </Button>
          </div>
        </section>
        <SubscribeDialog
          open={open}
          onOpenChange={setOpen}
          selectedPlan={selectedPlan}
          onSelectPlan={setSelectedPlan}
          phoneValue={phoneValue}
          onPhoneChange={setPhoneValue}
          monthlyPrice={settings.subscriptionMonthlyPrice}
          annualPrice={settings.subscriptionAnnualPrice}
          selectedPrice={selectedPrice}
          submitting={submitting}
          onSubmit={handleSubscribe}
          t={t}
        />
      </>
    );
  }

  // ── NONE ────────────────────────────────────────────────────────────────────
  return (
    <>
      <section className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-semibold">{t('cardTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('noneDesc')}</p>
            </div>
          </div>
          <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
            {t('subscribeCta')}
          </Button>
        </div>
      </section>
      <SubscribeDialog
        open={open}
        onOpenChange={setOpen}
        selectedPlan={selectedPlan}
        onSelectPlan={setSelectedPlan}
        phoneValue={phoneValue}
        onPhoneChange={setPhoneValue}
        monthlyPrice={settings.subscriptionMonthlyPrice}
        annualPrice={settings.subscriptionAnnualPrice}
        selectedPrice={selectedPrice}
        submitting={submitting}
        onSubmit={handleSubscribe}
        t={t}
      />
    </>
  );
}

// ── Subscribe dialog ─────────────────────────────────────────────────────────

interface SubscribeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPlan: SubscriptionPlan;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  phoneValue: string;
  onPhoneChange: (v: string) => void;
  monthlyPrice: number;
  annualPrice: number;
  selectedPrice: number;
  submitting: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
}

function SubscribeDialog({
  open,
  onOpenChange,
  selectedPlan,
  onSelectPlan,
  phoneValue,
  onPhoneChange,
  monthlyPrice,
  annualPrice,
  selectedPrice,
  submitting,
  onSubmit,
  t,
}: SubscribeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('choosePlan')}</DialogTitle>
          <DialogDescription>{t('cardSubtitle')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Plan selector */}
          <div className="grid grid-cols-2 gap-3">
            {(['MONTHLY', 'ANNUAL'] as SubscriptionPlan[]).map((p) => {
              const price = p === 'MONTHLY' ? monthlyPrice : annualPrice;
              const label = p === 'MONTHLY'
                ? t('planMonthlyDesc', { price: price.toLocaleString() })
                : t('planAnnualDesc', { price: price.toLocaleString() });
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onSelectPlan(p)}
                  className={cn(
                    'rounded-xl border p-3 text-left text-sm transition-colors',
                    selectedPlan === p
                      ? 'border-primary bg-primary/10 font-semibold text-primary'
                      : 'border-border bg-card hover:bg-secondary'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Phone number */}
          <div className="space-y-1.5">
            <Label htmlFor="sub-phone">
              <span className="flex items-center gap-1.5">
                <Smartphone className="h-4 w-4" />
                {t('phoneLabel')}
              </span>
            </Label>
            <Input
              id="sub-phone"
              name="phone"
              inputMode="tel"
              placeholder={t('phonePlaceholder')}
              value={phoneValue}
              onChange={(e) => onPhoneChange(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('payNow', { amount: selectedPrice.toLocaleString() })
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
