'use client';

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';

/**
 * Location + minimum-pay filter for the jobs feed — the employment-side twin of
 * MarketplaceFilters. The Job/Gig split stays in the always-visible chips
 * (JobFilters); this dialog holds the finer filters the schema already supports.
 */
export function JobFilterDialog({ current }: { current: Record<string, string | undefined> }) {
  const t = useTranslations('jobs');
  const tc = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({
    location: current.location ?? '',
    minPay: current.minPay ?? '',
  });

  function apply() {
    const sp = new URLSearchParams();
    if (current.q) sp.set('q', current.q);
    if (current.type) sp.set('type', current.type); // keep the Job/Gig chip
    if (state.location) sp.set('location', state.location);
    if (state.minPay) sp.set('minPay', state.minPay);
    router.push(`/jobs${sp.toString() ? `?${sp}` : ''}`);
    setOpen(false);
  }

  function clear() {
    setState({ location: '', minPay: '' });
    const sp = new URLSearchParams();
    if (current.q) sp.set('q', current.q);
    if (current.type) sp.set('type', current.type);
    router.push(`/jobs${sp.toString() ? `?${sp}` : ''}`);
    setOpen(false);
  }

  const activeCount = [state.location, state.minPay].filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <SlidersHorizontal className="h-4 w-4" />
          {t('filters')}
          {activeCount > 0 && (
            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('filters')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="jf-loc">{t('form.locationLabel')}</Label>
            <Input
              id="jf-loc"
              value={state.location}
              onChange={(e) => setState((s) => ({ ...s, location: e.target.value }))}
              placeholder="Kigali"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jf-pay">{t('form.payMinLabel')}</Label>
            <Input
              id="jf-pay"
              type="number"
              inputMode="numeric"
              min={0}
              value={state.minPay}
              onChange={(e) => setState((s) => ({ ...s, minPay: e.target.value }))}
            />
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          {activeCount > 0 ? (
            <Button variant="outline" className="flex-1" onClick={clear}>
              <X className="h-4 w-4" /> {tc('clear')}
            </Button>
          ) : (
            <DialogClose asChild>
              <Button variant="outline" className="flex-1">
                <X className="h-4 w-4" /> {tc('close')}
              </Button>
            </DialogClose>
          )}
          <Button className="flex-1" onClick={apply}>
            {tc('filter')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
