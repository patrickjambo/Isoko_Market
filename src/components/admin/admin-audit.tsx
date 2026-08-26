'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Loader2, ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useToast } from '@/components/ui/toast';
import { adminApi } from '@/lib/admin-client';
import { timeAgo } from '@/lib/utils';

type Entry = {
  id: string;
  action: string;
  actor: string;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  createdAt: string;
};

export function AdminAudit({ locale }: { locale: string }) {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(30);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set('q', q.trim());
      sp.set('page', String(page));
      const { data, meta } = await adminApi<{ entries: Entry[] }>(`/api/admin/audit?${sp}`);
      setEntries(data.entries);
      setTotal((meta?.total as number) ?? 0);
      setPageSize((meta?.pageSize as number) ?? 30);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setLoading(false);
    }
  }, [q, page, toast]);

  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder={t('searchAudit')}
          className="pl-9"
        />
      </div>

      {loading && entries.length === 0 ? (
        <div className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon={ScrollText} title={t('noAudit')} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start gap-3 p-3">
                <Badge variant="outline" className="mt-0.5 font-mono">
                  {e.action}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{e.actor}</span>
                    {e.targetType && (
                      <span className="text-muted-foreground">
                        {' → '}
                        {e.targetType} {e.targetId ? `(${e.targetId.slice(0, 12)}…)` : ''}
                      </span>
                    )}
                  </p>
                  {e.reason && <p className="text-xs text-muted-foreground">“{e.reason}”</p>}
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(e.createdAt, locale)}
                </time>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
