'use client';

import { useState } from 'react';
import { BellRing, Loader2, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export type AlertRow = {
  id: string;
  label: string;
  summary: string; // human-readable criteria, built server-side
};

/** Manage marketplace "notify me" alerts — delete removes the rule immediately. */
export function AlertList({ alerts }: { alerts: AlertRow[] }) {
  const t = useTranslations('marketplace');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/saved-searches/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast(tc('deleted'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li
          key={a.id}
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
            <BellRing className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{a.label}</p>
            <p className="truncate text-sm text-muted-foreground">{a.summary}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={tc('delete')}
            onClick={() => remove(a.id)}
            disabled={deleting === a.id}
          >
            {deleting === a.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 text-destructive" />
            )}
          </Button>
        </li>
      ))}
    </ul>
  );
}
