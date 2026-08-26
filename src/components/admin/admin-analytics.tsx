'use client';

import { useEffect, useState } from 'react';
import { Loader2, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useCan } from '@/components/admin/admin-context';
import { adminApi } from '@/lib/admin-client';

type Kpis = Record<string, number>;

const LABELS: Record<string, string> = {
  users: 'metricUsers',
  verifiedPct: 'kpiVerifiedPct',
  transactions: 'metricTransactions',
  revenueRwf: 'kpiRevenue',
  partners: 'partners',
  msmePartners: 'kpiMsme',
  jobs: 'metricJobs',
  jobsFilled: 'metricFilled',
  listings: 'metricListings',
  ruralPct: 'kpiRuralPct',
};
const PERCENT = new Set(['verifiedPct', 'ruralPct']);

export function AdminAnalytics() {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const can = useCan();
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi<{ kpis: Kpis }>('/api/admin/analytics')
      .then(({ data }) => setKpis(data.kpis))
      .catch((e) => toast(e instanceof Error ? e.message : 'error', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  if (!kpis) return null;

  return (
    <div className="space-y-5">
      {can('analytics.export') && (
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <a href="/api/admin/analytics?format=csv" download>
              <Download className="h-4 w-4" /> {t('exportCsv')}
            </a>
          </Button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(LABELS).map(([key, labelKey]) => (
          <div key={key} className="rounded-xl border border-border bg-card p-4">
            <p className="text-2xl font-extrabold">
              {(kpis[key] ?? 0).toLocaleString()}
              {PERCENT.has(key) ? '%' : ''}
            </p>
            <p className="text-xs text-muted-foreground">{t(labelKey)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
