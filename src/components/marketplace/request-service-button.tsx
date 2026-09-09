'use client';

import { useState } from 'react';
import { Loader2, Send, Check } from 'lucide-react';
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

/**
 * Formal "request this service" — the seeker describes what they need and MUST
 * agree to the terms before sending. Creates a ServiceRequest the provider then
 * confirms/declines (see /dashboard/requests). This is more than a chat: it's a
 * tracked, agreed request.
 */
export function RequestServiceButton({
  listingId,
  label,
  alreadyRequested = false,
}: {
  listingId: string;
  label: string;
  alreadyRequested?: boolean;
}) {
  const t = useTranslations('marketplace');
  const router = useRouter();
  const { toast } = useToast();
  const user = useSession();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(alreadyRequested);

  if (!user) return <SignUpPrompt reason={t('requestServiceBody')} triggerLabel={label} />;

  if (done) {
    return (
      <Button disabled variant="secondary">
        <Check className="h-4 w-4" /> {t('requestSent')}
      </Button>
    );
  }

  async function submit() {
    if (!agreed) return;
    setLoading(true);
    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, note, agreedTerms: true }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message ?? 'error');
      setDone(true);
      setOpen(false);
      toast(t('requestSent'), 'success');
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
        <Button variant="accent">{label}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('requestServiceTitle')}</DialogTitle>
          <DialogDescription>{t('requestServiceBody')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t('requestNoteLabel')}</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('requestNotePlaceholder')}
            rows={4}
          />
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input text-primary"
          />
          <span>
            {t('agreeTerms')}{' '}
            <Link href="/terms" target="_blank" className="font-medium text-primary underline">
              {t('termsLink')}
            </Link>
          </span>
        </label>

        <Button onClick={submit} disabled={loading || !agreed} variant="accent">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t('sendRequest')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
