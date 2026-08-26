'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Star, Trash2, StarOff, ChevronLeft, ChevronRight, PackageSearch } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useToast } from '@/components/ui/toast';
import { useCan } from '@/components/admin/admin-context';
import { adminApi } from '@/lib/admin-client';
import { formatRWF, timeAgo } from '@/lib/utils';

type Listing = {
  id: string;
  title: string;
  price: number;
  status: string;
  isFeatured: boolean;
  seller: string;
  createdAt: string;
};

const statusVariant: Record<string, 'success' | 'muted' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success',
  SOLD: 'secondary',
  REMOVED: 'destructive',
};

export function AdminListings({ locale }: { locale: string }) {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const can = useCan();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set('status', status);
      sp.set('page', String(page));
      const { data, meta } = await adminApi<{ listings: Listing[] }>(`/api/admin/listings?${sp}`);
      setListings(data.listings);
      setTotal((meta?.total as number) ?? 0);
      setPageSize((meta?.pageSize as number) ?? 20);
      setSelected(new Set());
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setLoading(false);
    }
  }, [status, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function bulk(action: 'remove' | 'feature' | 'unfeature') {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const { data } = await adminApi<{ count: number }>('/api/admin/listings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: [...selected] }),
      });
      toast(`${t('actionLogged')} (${data.count})`, 'success');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setBusy(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="max-w-[180px]">
          <option value="">{t('allStatuses')}</option>
          {['ACTIVE', 'SOLD', 'REMOVED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
        <span className="text-sm text-muted-foreground">{total}</span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-secondary/40 p-2">
          <span className="px-1 text-sm font-medium">{t('selectedCount', { count: selected.size })}</span>
          {can('listings.feature') && (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk('feature')}>
                <Star className="h-4 w-4" /> {t('feature')}
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => bulk('unfeature')}>
                <StarOff className="h-4 w-4" /> {t('unfeature')}
              </Button>
            </>
          )}
          {can('listings.remove') && (
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => bulk('remove')}>
              <Trash2 className="h-4 w-4" /> {t('removeListing')}
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : listings.length === 0 ? (
        <EmptyState icon={PackageSearch} title={t('noListings')} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {listings.map((l) => (
              <li key={l.id} className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  checked={selected.has(l.id)}
                  onChange={() => toggle(l.id)}
                  className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={l.title}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{l.title}</span>
                    {l.isFeatured && <Star className="h-3.5 w-3.5 fill-accent text-accent" />}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.seller} · {timeAgo(l.createdAt, locale)}
                  </p>
                </div>
                <span className="text-sm font-semibold">{formatRWF(l.price, locale)}</span>
                <Badge variant={statusVariant[l.status] ?? 'muted'}>{l.status}</Badge>
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
          <span className="text-sm text-muted-foreground">{page} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
