'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { useToast } from '@/components/ui/toast';
import { adminApi } from '@/lib/admin-client';
import { formatRWF, timeAgo } from '@/lib/utils';

type Tx = {
  id: string;
  user: string;
  type: string;
  amount: number;
  provider: string;
  status: string;
  createdAt: string;
};
type Revenue = { today: number; mtd: number; byType: { type: string; amount: number }[] };

const statusVariant: Record<string, 'success' | 'muted' | 'destructive'> = {
  SUCCESS: 'success',
  PENDING: 'muted',
  FAILED: 'destructive',
  REFUNDED: 'muted',
};

export function AdminTransactions({ locale }: { locale: string }) {
  const t = useTranslations('admin');
  const tw = useTranslations('wallet');
  const { toast } = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set('status', status);
      sp.set('page', String(page));
      const { data, meta } = await adminApi<{ transactions: Tx[]; revenue: Revenue }>(
        `/api/admin/transactions?${sp}`
      );
      setTxs(data.transactions);
      setRevenue(data.revenue);
      setTotal((meta?.total as number) ?? 0);
      setPageSize((meta?.pageSize as number) ?? 25);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setLoading(false);
    }
  }, [status, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      {/* Revenue summary */}
      {revenue && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('revenueToday')}</p>
            <p className="text-xl font-extrabold text-primary">{formatRWF(revenue.today, locale)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t('revenueMtd')}</p>
            <p className="text-xl font-extrabold text-primary">{formatRWF(revenue.mtd, locale)}</p>
          </div>
          {revenue.byType.slice(0, 2).map((b) => (
            <div key={b.type} className="rounded-xl border border-border bg-card p-4">
              <p className="truncate text-xs text-muted-foreground">{tw(`type.${b.type}`)}</p>
              <p className="text-xl font-extrabold">{formatRWF(b.amount, locale)}</p>
            </div>
          ))}
        </div>
      )}

      <Select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="max-w-[200px]">
        <option value="">{t('allStatuses')}</option>
        {['SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'].map((s) => (
          <option key={s} value={s}>{tw(`txStatus.${s}`)}</option>
        ))}
      </Select>

      {loading && txs.length === 0 ? (
        <div className="flex items-center justify-center p-10 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : txs.length === 0 ? (
        <EmptyState icon={CreditCard} title={t('noTransactions')} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {txs.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {tw(`type.${tx.type}`)} · <span className="text-muted-foreground">{tx.user}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.provider} · {timeAgo(tx.createdAt, locale)}
                  </p>
                </div>
                <span className="font-semibold">{formatRWF(tx.amount, locale)}</span>
                <Badge variant={statusVariant[tx.status]}>{tw(`txStatus.${tx.status}`)}</Badge>
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
