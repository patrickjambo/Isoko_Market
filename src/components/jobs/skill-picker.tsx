'use client';

import { useCallback, useRef, useState } from 'react';
import { Plus, X, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { labelForSkill, type SkillSuggestion } from '@/lib/skills';

const LEVELS = ['beginner', 'experienced', 'expert'] as const;
export type SkillLevel = (typeof LEVELS)[number];

/**
 * Tap-chip skill picker with search-as-you-type over the shared taxonomy
 * (Job Seeker spec §3 Step 2). Reused by the CV builder and the employer job
 * form so both sides speak the same vocabulary (§10). Skills are stored as
 * canonical keys; labels are resolved per-locale.
 *
 * When `levels`/`onLevels` are supplied (CV mode) each chip carries an optional
 * proficiency tap-select (Beginner/Experienced/Expert) — never required.
 */
export function SkillPicker({
  value,
  onChange,
  levels,
  onLevels,
  placeholder,
  max = 30,
}: {
  value: string[];
  onChange: (skills: string[]) => void;
  levels?: Record<string, SkillLevel>;
  onLevels?: (levels: Record<string, SkillLevel>) => void;
  placeholder?: string;
  max?: number;
}) {
  const t = useTranslations('cv');
  const locale = useLocale();
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState<SkillSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (query: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        if (query.trim().length < 1) return setSuggestions([]);
        try {
          const res = await fetch(
            `/api/suggestions/skills?q=${encodeURIComponent(query)}&locale=${locale}`
          );
          if (!res.ok) return setSuggestions([]);
          const j = await res.json();
          setSuggestions((j.data?.skills ?? j.skills ?? []) as SkillSuggestion[]);
          setOpen(true);
        } catch {
          setSuggestions([]);
        }
      }, 200);
    },
    [locale]
  );

  function add(key: string) {
    const k = key.trim();
    if (!k || value.includes(k) || value.length >= max) return;
    onChange([...value, k]);
    setQ('');
    setSuggestions([]);
    setOpen(false);
  }

  function remove(key: string) {
    onChange(value.filter((s) => s !== key));
    if (levels && onLevels) {
      const next = { ...levels };
      delete next[key];
      onLevels(next);
    }
  }

  function cycleLevel(key: string) {
    if (!onLevels) return;
    const current = levels?.[key];
    const idx = current ? LEVELS.indexOf(current) : -1;
    const next = { ...(levels ?? {}) };
    if (idx === LEVELS.length - 1) delete next[key];
    else next[key] = LEVELS[idx + 1]!;
    onLevels(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((key) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1.5 text-sm text-secondary-foreground"
          >
            {labelForSkill(key, locale)}
            {levels && onLevels && (
              <button
                type="button"
                onClick={() => cycleLevel(key)}
                className="rounded-full bg-background/70 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                aria-label={t('proficiency')}
              >
                {levels[key] ? t(`level_${levels[key]}`) : t('addLevel')}
              </button>
            )}
            <button type="button" onClick={() => remove(key)} aria-label="Remove">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="relative">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => suggestions.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              // Prefer the top suggestion; otherwise store the raw term.
              add(suggestions[0]?.key ?? q);
            }
          }}
          placeholder={placeholder ?? t('skillsPlaceholder')}
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            {suggestions.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(s.key);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {s.label}
                  {value.includes(s.key) && <Plus className="ml-auto h-3.5 w-3.5 rotate-45 text-muted-foreground" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
