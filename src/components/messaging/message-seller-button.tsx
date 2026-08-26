'use client';

import { useState } from 'react';
import { MessageCircle, Loader2, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
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
 * Starts (or resumes) a real-time conversation about a listing or job, then
 * routes into the chat thread. The primary contact CTA on detail pages.
 */
export function MessageSellerButton({
  listingId,
  jobId,
  label,
  className,
  variant = 'default',
}: {
  listingId?: string;
  jobId?: string;
  label: string;
  className?: string;
  variant?: 'default' | 'accent' | 'outline';
}) {
  const t = useTranslations();
  const router = useRouter();
  const { toast } = useToast();
  const user = useSession();
  const [open, setOpen] = useState(false);
  // Pre-fill a starter message for listings so shy/low-literacy buyers aren't
  // faced with a blank box (Section 5).
  const [body, setBody] = useState(listingId ? t('messages.starter') : '');
  const [loading, setLoading] = useState(false);

  if (!user) {
    // Gated guest action → inline "why sign up" + context preservation (§5).
    return (
      <SignUpPrompt
        reason={t('messages.gateMessage')}
        triggerLabel={label}
        variant={variant}
        className={className}
      />
    );
  }

  async function send() {
    if (!body.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, jobId, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'error');
      router.push(`/messages/${data.conversationId}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'error', 'error');
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          <MessageCircle className="h-4 w-4" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{t('messages.emptyHint')}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('messages.typePlaceholder')}
          rows={4}
          autoFocus
        />
        <Button onClick={send} disabled={loading || !body.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t('messages.send')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
