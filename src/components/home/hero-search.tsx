'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

/** Prominent hero search — routes into the marketplace with the typed query. */
export function HeroSearch() {
  const t = useTranslations('home');
  const tc = useTranslations('common');
  const router = useRouter();
  const [q, setQ] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/marketplace?q=${encodeURIComponent(query)}` : '/marketplace');
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-xl gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={tc('search')}
          className="h-12 w-full rounded-xl border border-white/30 bg-white/95 pl-11 pr-4 text-foreground shadow-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <button
        type="submit"
        className="h-12 shrink-0 rounded-xl bg-accent px-5 font-semibold text-accent-foreground shadow-lg transition-colors hover:bg-accent/90"
      >
        {tc('search')}
      </button>
    </form>
  );
}
