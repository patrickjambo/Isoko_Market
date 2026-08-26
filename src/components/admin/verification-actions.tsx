'use client';

import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

export function VerificationActions({ requestId }: { requestId: string }) {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  async function decide(decision: 'approve' | 'reject') {
    setLoading(decision);
    try {
      const res = await fetch(`/api/admin/verifications/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error();
      toast(decision === 'approve' ? t('approve') : t('reject'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => decide('approve')} disabled={loading !== null}>
        {loading === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {t('approve')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => decide('reject')}
        disabled={loading !== null}
      >
        {loading === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        {t('reject')}
      </Button>
    </div>
  );
}
