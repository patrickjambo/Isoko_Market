'use client';

import { useCallback, useRef, useState } from 'react';
import { Search, Tag, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Input } from '@/components/ui/input';

/**
 * Global search — reachable within one tap from any screen (Section 8.2), with
 * autocomplete drawn from the SAME suggestion engine the seller uses, so buyer
 * queries and seller titles share one vocabulary (Section 3/10).
 */
export function SearchBar({ className }: { className?: string }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState<{ value: string; type: string }[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (query: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        if (query.trim().length < 2) return setSuggestions([]);
        try {
          const res = await fetch(
            `/api/suggestions/titles?q=${encodeURIComponent(query)}&locale=${locale}`
          );
          if (!res.ok) return setSuggestions([]);
          const j = await res.json();
          setSuggestions(j.suggestions ?? []);
          setOpen(true);
        } catch {
          setSuggestions([]);
        }
      }, 250);
    },
    [locale]
  );

  function go(query: string) {
    const clean = query.trim();
    setOpen(false);
    router.push(clean ? `/marketplace?q=${encodeURIComponent(clean)}` : '/marketplace');
  }

  return (
    <div className={className} role="search">
      <form onSubmit={(e) => { e.preventDefault(); go(q); }} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => suggestions.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('search')}
          className="pl-9"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            {suggestions.map((s) => (
              <li key={s.value + s.type}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(s.value);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  {s.type === 'category' ? (
                    <Tag className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  {s.value}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  );
}
