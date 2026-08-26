'use client';

import { useState } from 'react';
import { BellPlus, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useSession } from '@/components/providers';
import { useRouter, usePathname } from '@/i18n/routing';

/**
 * "Notify me about jobs like this" (§8) — persists the current filter as a
 * saved search evaluated live against every new posting. One tap, no dialog.
 */
export function SaveSearchButton({
  current,
}: {
  current: { q?: string; type?: string; location?: string };
}) {
  const t = useTranslations('jobs');
  const { toast } = useToast();
  const user = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Nothing to save if there are no active filters.
  const hasFilter = Boolean(current.q || current.type || current.location);
  if (!hasFilter) return null;

  async function save() {
    if (!user) return router.push(`/register?returnTo=${encodeURIComponent(pathname)}`);
    setLoading(true);
    try {
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: current.q,
          type: current.type === 'JOB' || current.type === 'GIG' ? current.type : undefined,
          location: current.location,
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
      {saved ? t('searchSaved') : t('saveSearch')}
    </Button>
  );
}
