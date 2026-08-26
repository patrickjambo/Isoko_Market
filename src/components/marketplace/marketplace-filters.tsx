'use client';

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
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
  DialogClose,
} from '@/components/ui/dialog';
import { listingConditions } from '@/lib/validators/listing';

type Category = { id: string; name: string };

export function MarketplaceFilters({
  categories,
  current,
}: {
  categories: Category[];
  current: Record<string, string | undefined>;
}) {
  const t = useTranslations('marketplace');
  const tc = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({
    categoryId: current.categoryId ?? '',
    minPrice: current.minPrice ?? '',
    maxPrice: current.maxPrice ?? '',
    location: current.location ?? '',
    condition: current.condition ?? '',
    verifiedOnly: current.verifiedOnly === 'true',
    sort: current.sort ?? 'newest',
  });

  function apply() {
    const sp = new URLSearchParams();
    if (current.q) sp.set('q', current.q);
    if (state.categoryId) sp.set('categoryId', state.categoryId);
    if (state.minPrice) sp.set('minPrice', state.minPrice);
    if (state.maxPrice) sp.set('maxPrice', state.maxPrice);
    if (state.location) sp.set('location', state.location);
    if (state.condition) sp.set('condition', state.condition);
    if (state.verifiedOnly) sp.set('verifiedOnly', 'true');
    if (state.sort && state.sort !== 'newest') sp.set('sort', state.sort);
    router.push(`/marketplace?${sp.toString()}`);
    setOpen(false);
  }

  const activeCount = [
    state.categoryId,
    state.minPrice,
    state.maxPrice,
    state.location,
    state.condition,
    state.verifiedOnly ? '1' : '',
  ].filter(Boolean).length;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={state.sort}
        onChange={(e) => {
          const sort = e.target.value;
          setState((s) => ({ ...s, sort }));
          const sp = new URLSearchParams(
            Object.entries(current).filter(([, v]) => v) as [string, string][]
          );
          if (sort === 'newest') sp.delete('sort');
          else sp.set('sort', sort);
          router.push(`/marketplace?${sp.toString()}`);
        }}
        className="max-w-[180px]"
        aria-label={t('sortBy')}
      >
        <option value="newest">{t('sortNewest')}</option>
        <option value="price_asc">{t('sortPriceLow')}</option>
        <option value="price_desc">{t('sortPriceHigh')}</option>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="default" className="shrink-0">
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
              <Label htmlFor="f-cat">{t('categories')}</Label>
              <Select
                id="f-cat"
                value={state.categoryId}
                onChange={(e) => setState((s) => ({ ...s, categoryId: e.target.value }))}
              >
                <option value="">{tc('all')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="f-min">{t('minPrice')}</Label>
                <Input
                  id="f-min"
                  type="number"
                  inputMode="numeric"
                  value={state.minPrice}
                  onChange={(e) => setState((s) => ({ ...s, minPrice: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-max">{t('maxPrice')}</Label>
                <Input
                  id="f-max"
                  type="number"
                  inputMode="numeric"
                  value={state.maxPrice}
                  onChange={(e) => setState((s) => ({ ...s, maxPrice: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-loc">{t('location')}</Label>
              <Input
                id="f-loc"
                value={state.location}
                onChange={(e) => setState((s) => ({ ...s, location: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-cond">{t('form.conditionLabel')}</Label>
              <Select
                id="f-cond"
                value={state.condition}
                onChange={(e) => setState((s) => ({ ...s, condition: e.target.value }))}
              >
                <option value="">{tc('all')}</option>
                {listingConditions.map((c) => (
                  <option key={c} value={c}>
                    {t(`condition.${c}`)}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={state.verifiedOnly}
                onChange={(e) => setState((s) => ({ ...s, verifiedOnly: e.target.checked }))}
                className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
              />
              {t('verifiedOnly')}
            </label>
          </div>
          <div className="mt-2 flex gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1">
                <X className="h-4 w-4" /> {tc('close')}
              </Button>
            </DialogClose>
            <Button className="flex-1" onClick={apply}>
              {tc('filter')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
