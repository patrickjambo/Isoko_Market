'use client';

import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ListingSpec } from '@/lib/validators/listing';

/**
 * Editable product feature list (RAM, processor, year, …). Category-suggested
 * labels appear as one-tap chips; the seller can also add fully custom rows. So
 * a buyer sees the real details of what they're buying.
 */
export function SpecsEditor({
  value,
  onChange,
  suggestions,
}: {
  value: ListingSpec[];
  onChange: (v: ListingSpec[]) => void;
  suggestions: string[];
}) {
  const t = useTranslations('sell');

  const update = (i: number, patch: Partial<ListingSpec>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = (label = '') => onChange([...value, { label, value: '' }]);

  const used = new Set(value.map((s) => s.label.trim().toLowerCase()));
  const freeSuggestions = suggestions.filter((s) => !used.has(s.toLowerCase()));

  return (
    <div className="space-y-2">
      <Label>{t('specsLabel')}</Label>
      <p className="text-xs text-muted-foreground">{t('specsHint')}</p>

      {value.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={s.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder={t('specLabelPlaceholder')}
            className="w-2/5"
            maxLength={40}
          />
          <Input
            value={s.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder={t('specValuePlaceholder')}
            className="flex-1"
            maxLength={200}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="remove"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {freeSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {freeSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2.5 py-0.5 text-xs text-primary hover:bg-primary/5"
            >
              <Plus className="h-3 w-3" /> {s}
            </button>
          ))}
        </div>
      )}

      {value.length < 20 && (
        <button
          type="button"
          onClick={() => add()}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <Plus className="h-4 w-4" /> {t('addSpec')}
        </button>
      )}
    </div>
  );
}
