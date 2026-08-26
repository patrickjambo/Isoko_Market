'use client';

import { useState } from 'react';
import { CheckCircle2, CalendarClock, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

/**
 * Structured hiring actions pinned to the top of an employer↔applicant thread
 * (§5): "Confirm Hire" and "Schedule Interview" (a simple date/time picker, not
 * a calendar integration) — so routine coordination doesn't need free typing.
 * Confirming a hire fires the same job-filled cascade as everywhere else.
 */
export function ChatHiringActions({
  conversationId,
  applicationId,
  jobTitle,
  applicantName,
  initialStatus,
}: {
  conversationId: string;
  applicationId: string;
  jobTitle: string;
  applicantName: string;
  initialStatus: string;
}) {
  const t = useTranslations('employer');
  const ts = useTranslations('jobs.status');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [when, setWhen] = useState('');

  const terminal = status === 'HIRED' || status === 'REJECTED' || status === 'POSITION_FILLED';

  async function setAppStatus(next: string): Promise<boolean> {
    const res = await fetch(`/api/applications/${applicationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    return res.ok;
  }

  async function sendMessage(body: string) {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, body }),
    });
  }

  async function confirmHire() {
    if (!window.confirm(t('hireConfirm', { name: applicantName }))) return;
    setBusy(true);
    try {
      if (!(await setAppStatus('HIRED'))) throw new Error();
      await sendMessage(t('hireMessage', { job: jobTitle }));
      setStatus('HIRED');
      toast(ts('HIRED'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function scheduleInterview() {
    if (!when) return;
    setBusy(true);
    try {
      if (!(await setAppStatus('INTERVIEW'))) throw new Error();
      const nice = new Date(when).toLocaleString();
      await sendMessage(t('interviewMessage', { time: nice }));
      setStatus('INTERVIEW');
      setInterviewOpen(false);
      toast(t('interviewScheduled'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-secondary/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{t('hiringPanel')}</p>
          <p className="truncate text-xs text-muted-foreground">
            {applicantName} · {jobTitle}
          </p>
        </div>
        <Badge variant={status === 'HIRED' ? 'success' : 'muted'}>{ts(status)}</Badge>
      </div>

      {terminal ? (
        <p className="text-xs text-muted-foreground">
          {status === 'HIRED' ? t('alreadyHired') : t('applicationClosed')}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="accent" onClick={confirmHire} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {t('confirmHire')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setInterviewOpen(true)} disabled={busy}>
            <CalendarClock className="h-4 w-4" /> {t('scheduleInterview')}
          </Button>
        </div>
      )}

      <Dialog open={interviewOpen} onOpenChange={setInterviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('scheduleInterview')}</DialogTitle>
            <DialogDescription>{t('interviewHint', { name: applicantName })}</DialogDescription>
          </DialogHeader>
          <label className="text-sm font-medium">{t('interviewTime')}</label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button onClick={scheduleInterview} disabled={busy || !when} variant="accent">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
            {t('sendInvite')}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
