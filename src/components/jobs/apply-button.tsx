'use client';

import { useState } from 'react';
import { Loader2, Send, Check, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useSession } from '@/components/providers';
import { SignUpPrompt } from '@/components/auth/sign-up-prompt';

export function ApplyButton({
  jobId,
  hasCv,
  alreadyApplied,
}: {
  jobId: string;
  hasCv: boolean;
  alreadyApplied: boolean;
}) {
  const t = useTranslations('jobs');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const user = useSession();
  const [open, setOpen] = useState(false);
  // Pre-filled with an editable suggested opener (§6 one-click apply).
  const [coverNote, setCoverNote] = useState(() => t('coverNoteSuggested'));
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(alreadyApplied);

  if (applied) {
    return (
      <Button disabled variant="secondary">
        <Check className="h-4 w-4" /> {t('applied')}
      </Button>
    );
  }

  if (!user) {
    // Gated guest action → explain why + preserve context through sign-up (§5).
    return <SignUpPrompt reason={t('gateApply')} triggerLabel={t('apply')} />;
  }

  // No CV yet — guide the user to the builder first (Section 6.3).
  if (!hasCv) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="accent">{t('apply')}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('apply')}</DialogTitle>
            <DialogDescription>{t('needCv')}</DialogDescription>
          </DialogHeader>
          <Button asChild>
            <Link href="/cv">
              <FileText className="h-4 w-4" /> {t('buildCvCta')}
            </Link>
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  async function apply() {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'error');
      toast(t('applied'), 'success');
      setApplied(true);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'error', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent">{t('applyWithCv')}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('applyWithCv')}</DialogTitle>
          <DialogDescription>{t('applyingWith')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 p-2.5 text-xs text-muted-foreground">
          <FileText className="h-4 w-4 shrink-0" /> {t('snapshotNote')}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t('coverNoteLabel')}</label>
          <Textarea
            value={coverNote}
            onChange={(e) => setCoverNote(e.target.value)}
            placeholder={t('coverNotePlaceholder')}
            rows={4}
          />
        </div>
        <Button onClick={apply} disabled={loading} variant="accent">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {tc('submit')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
