'use client';

import { useCallback } from 'react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { RefAutocomplete, type RefOption } from '@/components/cv/ref-autocomplete';

type Level = 'province' | 'district' | 'sector' | 'cell';
const LEVELS: Level[] = ['province', 'district', 'sector', 'cell'];

/**
 * Shared 4-level cascading location picker (CV Builder spec Part 6): Province →
 * District → Sector → Cell, each type-to-search (not a giant dropdown), each
 * level filtered by the one above. Reusable for CV location, marketplace listing
 * location and job posting location (Rule 3 — one component). Emits the
 * most-specific selection as { id, label: full path } (or null while incomplete).
 */
export function LocationPicker({
  value,
  onChange,
}: {
  value: { id: string; label: string } | null;
  onChange: (v: { id: string; label: string } | null) => void;
}) {
  const t = useTranslations('cv');
  // Selection per level; picking a level clears the deeper ones.
  const [sel, setSel] = useState<Record<Level, RefOption | null>>(() => ({
    province: null,
    district: null,
    sector: null,
    cell: null,
  }));

  const fetcher = useCallback(
    (level: Level, parentId?: string) => async (q: string): Promise<RefOption[]> => {
      const sp = new URLSearchParams({ level });
      if (q) sp.set('q', q);
      if (parentId) sp.set('parentId', parentId);
      const res = await fetch(`/api/suggestions/locations?${sp.toString()}`);
      if (!res.ok) return [];
      const j = await res.json();
      const rows = (j.data?.locations ?? j.locations ?? []) as { id: string; name: string }[];
      return rows.map((r) => ({ id: r.id, label: r.name }));
    },
    []
  );

  function choose(level: Level, opt: RefOption | null) {
    const idx = LEVELS.indexOf(level);
    const next = { ...sel, [level]: opt };
    // Clear deeper levels when a shallower one changes.
    for (const deeper of LEVELS.slice(idx + 1)) next[deeper] = null;
    setSel(next);

    // Emit the most-specific chosen level as the value, with the full path label.
    let deepest: RefOption | null = null;
    const labels: string[] = [];
    for (const l of LEVELS) {
      if (next[l]) {
        deepest = next[l];
        labels.push(next[l]!.label);
      } else break;
    }
    onChange(deepest ? { id: deepest.id, label: labels.join(' › ') } : null);
  }

  return (
    <div className="space-y-3">
      {value && (
        <p className="rounded-lg bg-secondary/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t('selectedLocation')}: </span>
          {value.label}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {LEVELS.map((level, i) => {
          const parent = i === 0 ? undefined : sel[LEVELS[i - 1]!];
          const disabled = i > 0 && !parent;
          return (
            <div key={level} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t(`level_${level}`)}</Label>
              <RefAutocomplete
                value={sel[level]}
                onChange={(opt) => choose(level, opt)}
                fetchOptions={fetcher(level, parent?.id)}
                placeholder={t(`level_${level}`)}
                disabled={disabled}
                disabledHint={t('pickPrevious')}
              />
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('locationHint')}</p>
    </div>
  );
}
