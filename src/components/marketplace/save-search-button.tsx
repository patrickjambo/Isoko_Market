'use client';

import { useState } from 'react';
import { BellPlus, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useSession } from '@/components/providers';
import { useRouter, usePathname } from '@/i18n/routing';

type Current = {
  q?: string;
  categoryId?: string;
  condition?: string;
  location?: string;
  minPrice?: string;
  maxPrice?: string;
};

/**
 * "Notify me about items like this" — the marketplace twin of the jobs
 * SaveSearchButton (§8). Persists the active filter as a saved search that's
 * evaluated live against every new listing. One tap, no dialog.
 */
export function SaveSearchButton({ current }: { current: Current }) {
  const t = useTranslations('marketplace');
  const { toast } = useToast();
  const user = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Nothing to save if there are no active filters.
  const hasFilter = Boolean(
    current.q || current.categoryId || current.condition || current.location || current.minPrice || current.maxPrice
  );
  if (!hasFilter) return null;

  async function save() {
    if (!user) return router.push(`/register?returnTo=${encodeURIComponent(pathname)}`);
    setLoading(true);
    try {
      const res = await fetch('/api/listing-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: current.q,
          categoryId: current.categoryId,
          condition: current.condition,
          location: current.location,
          minPrice: current.minPrice ? Number(current.minPrice) : undefined,
          maxPrice: current.maxPrice ? Number(current.maxPrice) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'error');
      setSaved(true);
      toast(t('searchSaved'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'error', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={save} disabled={loading || saved}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saved ? (
        <Check className="h-4 w-4" />
      ) : (
        <BellPlus className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">{saved ? t('searchSaved') : t('saveSearch')}</span>
    </Button>
  );
}
