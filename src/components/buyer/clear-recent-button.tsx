'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

/** Clears the "Recently viewed" strip by deleting the user's view history. */
export function ClearRecentButton() {
  const t = useTranslations('buyer');
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function clear() {
    setBusy(true);
    try {
      await fetch('/api/listings/views', { method: 'DELETE' });
    } catch {
      /* best-effort */
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={clear}
      disabled={busy}
      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}{' '}
      {t('clearRecent')}
    </button>
  );
}
