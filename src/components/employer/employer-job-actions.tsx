'use client';

import { useState } from 'react';
import { MoreVertical, Users, XCircle, RotateCcw, Copy, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';

/** Inline quick actions per posting (§6) — no separate page needed. */
export function EmployerJobActions({ jobId, status }: { jobId: string; status: string }) {
  const t = useTranslations('employer');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function setStatus(next: 'OPEN' | 'CLOSED') {
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      toast(next === 'CLOSED' ? t('jobClosed') : t('jobReopened'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function repost() {
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/repost`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'error');
      toast(t('reposted'), 'success');
      router.push(`/jobs/${data.data?.id ?? data.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'error', 'error');
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
        aria-label={t('actions')}
        disabled={busy}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/jobs/${jobId}/applicants`}>
            <Users className="h-4 w-4" /> {t('reviewApplicants')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {status === 'OPEN' ? (
          <DropdownMenuItem onSelect={() => setStatus('CLOSED')}>
            <XCircle className="h-4 w-4" /> {t('closeFill')}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => setStatus('OPEN')}>
            <RotateCcw className="h-4 w-4" /> {t('reopen')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={repost}>
          <Copy className="h-4 w-4" /> {t('repost')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
