'use client';

import { useEffect, useState } from 'react';
import { FileEdit, ArrowRight, X, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';

type Draft = { data: { title?: string; kind?: string } | null; step?: number };

/**
 * "Finish your listing" — surfaces the seller's autosaved, unpublished Add-Product
 * draft so they can resume where they left off (→ the wizard reloads it) or
 * discard it. Self-hides when there's no draft (or nothing substantive in it yet).
 */
export function ResumeDraft() {
  const t = useTranslations('sell');
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [discarding, setDiscarding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/seller/draft')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const d: Draft | null = j?.draft ?? null;
        // Only worth showing once they've named the item.
        if (d?.data?.title?.trim()) setDraft(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!draft?.data?.title) return null;

  const href = draft.data.kind === 'SERVICE' ? '/dashboard/sell?kind=service' : '/dashboard/sell';

  async function discard() {
    setDiscarding(true);
    try {
      await fetch('/api/seller/draft', { method: 'DELETE' });
    } catch {
      /* best-effort */
    }
    setDraft(null);
    router.refresh();
  }

  return (
    <div className="container pt-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
          <FileEdit className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t('resumeTitle')}</p>
          <p className="truncate text-sm text-muted-foreground">{draft.data.title}</p>
        </div>
        <Button asChild size="sm" variant="accent">
          <Link href={href}>
            {t('resumeContinue')} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={discard}
          disabled={discarding}
          className="text-destructive"
        >
          {discarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}{' '}
          {t('resumeDiscard')}
        </Button>
      </div>
    </div>
  );
}
