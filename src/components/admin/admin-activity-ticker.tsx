'use client';

import { useCallback, useEffect, useState } from 'react';
import { Radio, UserPlus, Package, Briefcase, CreditCard, Flag, ShieldCheck, ShieldX, KeyRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRealtime } from '@/hooks/use-realtime';
import { cn } from '@/lib/utils';

type Item = { id: string; name: string; label: string; at: string };

const ICONS: Record<string, LucideIcon> = {
  signup: UserPlus,
  'listing.created': Package,
  'job.created': Briefcase,
  'transaction.completed': CreditCard,
  'transaction.failed': CreditCard,
  'report.created': Flag,
  'verification.pending': ShieldCheck,
  'verification.approved': ShieldCheck,
  'verification.rejected': ShieldX,
  'permission.changed': KeyRound,
};

/**
 * Auto-scrolling live feed of platform activity (Section: Real-Time Activity
 * card). SSE (admin_event) updates it instantly on the same instance; a
 * visibility-aware poll of /api/admin/activity keeps it populated everywhere
 * else — on Vercel the ephemeral admin bus can't cross instances, so without
 * the poll the ticker would sit empty. Both paths reconcile to the same
 * deterministic-id list.
 */
export function AdminActivityTicker() {
  const t = useTranslations('admin');
  const [items, setItems] = useState<Item[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/activity', { cache: 'no-store' });
      if (!res.ok) return;
      const { data } = await res.json();
      if (Array.isArray(data?.items)) setItems(data.items as Item[]);
    } catch {
      /* transient — next tick retries */
    }
  }, []);

  // SSE arrives → pull the authoritative list immediately (no manual merge).
  useRealtime((event) => {
    if (event.type === 'admin_event') void refresh();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let id: ReturnType<typeof setInterval> | null = null;
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const start = () => {
      if (id == null) id = setInterval(tick, 10000);
    };
    const stop = () => {
      if (id != null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
        start();
      } else stop();
    };
    document.addEventListener('visibilitychange', onVisibility);
    void refresh(); // seed immediately
    start();
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
        </span>
        <h3 className="font-semibold">{t('realtimeActivity')}</h3>
        <Radio className="ml-auto h-4 w-4 text-muted-foreground" />
      </div>
      {items.length === 0 ? (
        <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t('waitingForActivity')}
        </p>
      ) : (
        <ul className="flex-1 space-y-2 overflow-hidden">
          {items.map((item, i) => {
            const Icon = ICONS[item.name] ?? Radio;
            return (
              <li
                key={item.id}
                className={cn(
                  'flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-1',
                  i === 0 ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{item.label}</span>
                <time className="ml-auto shrink-0 text-[11px]">
                  {new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
