'use client';

import { useState } from 'react';
import { Loader2, Plus, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const PRESETS = [1000, 2000, 5000, 10000];

export function TopUpDialog() {
  const t = useTranslations('wallet');
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(2000);
  const [provider, setProvider] = useState('mtn_momo');
  const [loading, setLoading] = useState(false);

  async function pay() {
    setLoading(true);
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'TOPUP', amount, provider }),
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
        <Button variant="accent">
          <Plus className="h-4 w-4" /> {t('topUp')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('topUp')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p}
                type="button"
                variant={amount === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAmount(p)}
              >
                {p.toLocaleString()}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amount">{t('amount')} (RWF)</Label>
            <Input
              id="amount"
              type="number"
              min={100}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider">{t('payWith')}</Label>
            <Select id="provider" value={provider} onChange={(e) => setProvider(e.target.value)}>
              <option value="mtn_momo">{t('mtn')}</option>
              <option value="airtel_money">{t('airtel')}</option>
            </Select>
          </div>
          <Button onClick={pay} disabled={loading || amount < 100} className="w-full" size="lg">
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
