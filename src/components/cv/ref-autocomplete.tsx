'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Plus, X, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';

export type RefOption = { id: string; label: string };

/**
 * Shared single-select autocomplete over a seeded reference table (CV Builder
 * spec Part 3) — the SAME debounced pattern as the skills/title pickers (Rule 3),
 * for institutions, combinations, faculties and location levels. It stores the
 * chosen {id, label}; the label is kept so the immutable CV snapshot renders
 * without a DB join. An optional "Add '<typed>'" row routes to the caller's
 * add-new handler (admin review), the ONLY free-text escape hatch.
 */
export function RefAutocomplete({
  value,
  onChange,
  fetchOptions,
  onAdd,
  placeholder,
  disabled,
  disabledHint,
}: {
  value: RefOption | null;
  onChange: (option: RefOption | null) => void;
  /** Return matching options for the query (empty query may return top-N). */
  fetchOptions: (q: string) => Promise<RefOption[]>;
  /** When provided, shows "Add '<typed>'" for the raw text; returns the new option. */
  onAdd?: (name: string) => Promise<RefOption>;
  placeholder?: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const t = useTranslations('cv');
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<RefOption[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (query: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        try {
          setOptions(await fetchOptions(query));
          setOpen(true);
        } catch {
          setOptions([]);
        }
      }, 200);
    },
    [fetchOptions]
  );

  // Reset the typed query if the selection is cleared externally.
  useEffect(() => {
    if (!value) setQ('');
  }, [value]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-input bg-secondary/40 px-3 py-2 text-sm">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Check className="h-4 w-4 shrink-0 text-success" />
          <span className="truncate">{value.label}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t('change')}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const typed = q.trim();
  const showAdd = onAdd && typed.length >= 2 && !options.some((o) => o.label.toLowerCase() === typed.toLowerCase());

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        disabled={disabled}
        onChange={(e) => {
          setQ(e.target.value);
          search(e.target.value);
        }}
        onFocus={() => search(q)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={disabled ? disabledHint ?? placeholder : placeholder}
        className="pl-9"
      />
      {open && !disabled && (options.length > 0 || showAdd) && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover shadow-md">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o);
                  setOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                {o.label}
              </button>
            </li>
          ))}
          {showAdd && (
            <li className="border-t border-border">
              <button
                type="button"
                disabled={busy}
                onMouseDown={async (e) => {
                  e.preventDefault();
                  if (!onAdd) return;
                  setBusy(true);
                  try {
                    const created = await onAdd(typed);
                    onChange(created);
                    setOpen(false);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-secondary"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('addNamed', { name: typed })}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
