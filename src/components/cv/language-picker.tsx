'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { LANGUAGE_LEVELS, type LanguageEntry } from '@/lib/validators/cv';

// The platform's three languages; the store is an array of {code, level} so a
// 4th could be added here later with no schema change (spec Part 5).
const LANGS = ['rw', 'en', 'fr'] as const;

/**
 * Languages multi-select (spec Part 5): tap to toggle each language on, then an
 * OPTIONAL proficiency tap-chip. Nothing is required — a seeker can just pick
 * languages quickly.
 */
export function LanguagePicker({
  value,
  onChange,
}: {
  value: LanguageEntry[];
  onChange: (langs: LanguageEntry[]) => void;
}) {
  const t = useTranslations('cv');

  const has = (code: string) => value.some((l) => l.code === code);
  const levelOf = (code: string) => value.find((l) => l.code === code)?.level;

  function toggle(code: string) {
    onChange(has(code) ? value.filter((l) => l.code !== code) : [...value, { code }]);
  }
  function setLevel(code: string, level: LanguageEntry['level']) {
    onChange(
      value.map((l) => (l.code === code ? { ...l, level: l.level === level ? undefined : level } : l))
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {LANGS.map((code) => {
          const on = has(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                on
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-secondary'
              )}
            >
              {on && <Check className="h-4 w-4" />}
              {t(`lang_${code}`)}
            </button>
          );
        })}
      </div>

      {value.length > 0 && (
        <div className="space-y-2 rounded-lg border border-border p-3">
          {value.map((l) => (
            <div key={l.code} className="flex flex-wrap items-center gap-2">
              <span className="w-24 shrink-0 text-sm font-medium">{t(`lang_${l.code}`)}</span>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGE_LEVELS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevel(l.code, lvl)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs transition-colors',
                      levelOf(l.code) === lvl
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t(`proficiency_${lvl}`)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
