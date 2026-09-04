'use client';

import { useState } from 'react';
import { Loader2, Smartphone, BadgeCheck, Rocket } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

// Icons referenced by NAME so a Server Component can use this Client Component
// (a function/component can't cross the server→client boundary as a prop).
const ICONS = { badge: BadgeCheck, rocket: Rocket, smartphone: Smartphone } as const;

/**
 * Reusable Mobile Money purchase button for any premium feature (boost,
 * verified-seller subscription, paid job post). It only speaks to /api/payments,
 * which routes through the PaymentProvider abstraction (Section 6.4).
 */
export function PaymentButton({
  type,
  amount,
  metadata,
  label,
  title,
  description,
  icon,
  variant = 'accent',
  size = 'default',
  className,
}: {
  type: 'FEATURED_LISTING' | 'SUBSCRIPTION' | 'JOB_POST';
  amount: number;
  metadata?: Record<string, string>;
  label: string;
  title: string;
  description?: string;
  icon?: keyof typeof ICONS;
  variant?: 'default' | 'accent' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}) {
  const t = useTranslations('wallet');
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState('mtn_momo');
  const [loading, setLoading] = useState(false);
  const Icon = icon ? ICONS[icon] : null;

  async function pay() {
    setLoading(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, amount, provider, metadata }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'error');
      if (data.result.status === 'SUCCESS') {
        toast(t('success'), 'success');
        setOpen(false);
        router.refresh();
      } else if (data.result.status === 'PENDING') {
        toast(t('processing'), 'info');
        setOpen(false);
      } else {
        toast(t('failed'), 'error');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : t('failed'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          {Icon && <Icon className="h-4 w-4" />} {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-secondary/50 p-3 text-center">
            <p className="text-2xl font-extrabold text-primary">
              RWF {amount.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-provider">{t('payWith')}</Label>
            <Select
              id="pay-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="mtn_momo">{t('mtn')}</option>
              <option value="airtel_money">{t('airtel')}</option>
            </Select>
          </div>
          <Button onClick={pay} disabled={loading} className="w-full" size="lg">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
            {t('pay', { amount: `RWF ${amount.toLocaleString()}` })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
