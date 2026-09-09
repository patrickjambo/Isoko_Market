'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ListingSpec } from '@/lib/validators/listing';
import { suggestSpecs } from '@/lib/specs';

/**
 * Editable product feature list whose suggested labels adapt to the item the
 * seller is entering — instant keyword/category guess, refined by AI from the
 * title (so a phone gets RAM/Storage, a car Year/Mileage, rice Weight/Type…).
 * The seller can always add fully custom rows.
 */
export function SpecsEditor({
  value,
  onChange,
  title,
  categorySlug,
  categoryName,
}: {
  value: ListingSpec[];
  onChange: (v: ListingSpec[]) => void;
  title: string;
  categorySlug?: string;
  categoryName?: string;
}) {
  const t = useTranslations('sell');

  // Start with the deterministic guess so chips appear instantly; refine with
  // AI as the seller types the title / picks a category.
  const [suggestions, setSuggestions] = useState<string[]>(() => suggestSpecs(title, categorySlug));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Instant local guess first (keyword/category) so it's never empty or stale.
    setSuggestions(suggestSpecs(title, categorySlug));
    if (timer.current) clearTimeout(timer.current);
    if (title.trim().length < 3) return;
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/suggestions/specs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, category: categoryName, categorySlug }),
        });
        if (!res.ok) return;
        const j = await res.json();
        const specs = j.data?.specs ?? j.specs;
        if (Array.isArray(specs) && specs.length) setSuggestions(specs);
      } catch {
        /* keep the instant guess */
      }
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, categorySlug, categoryName]);

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
