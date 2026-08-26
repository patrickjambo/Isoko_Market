'use client';

import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useToast } from '@/components/ui/toast';

/** Lets a job seeker withdraw their own still-active application (§6.3). */
export function WithdrawApplicationButton({ applicationId }: { applicationId: string }) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function withdraw() {
    if (!window.confirm(t('withdrawConfirm'))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast(t('withdrawn'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={withdraw}
      disabled={busy}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
      {t('withdraw')}
    </button>
  );
}
