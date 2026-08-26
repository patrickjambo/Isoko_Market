'use client';

import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export function ReportActions({ reportId }: { reportId: string }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState<'RESOLVED' | 'DISMISSED' | null>(null);

  async function decide(status: 'RESOLVED' | 'DISMISSED') {
    setLoading(status);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast(status === 'RESOLVED' ? t('resolve') : t('dismiss'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => decide('RESOLVED')} disabled={loading !== null}>
        {loading === 'RESOLVED' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {t('resolve')}
      </Button>
      <Button size="sm" variant="outline" onClick={() => decide('DISMISSED')} disabled={loading !== null}>
        {loading === 'DISMISSED' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        {t('dismiss')}
      </Button>
    </div>
  );
}
