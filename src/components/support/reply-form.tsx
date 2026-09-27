'use client';

import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

/**
 * Add a reply to a support ticket (used by both the user and the admin thread).
 * On success the thread re-fetches so the new message appears immediately.
 */
export function ReplyForm({ ticketId }: { ticketId: string }) {
  const t = useTranslations('support');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/support/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? tc('error'));
      setBody('');
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('error'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder={t('replyPlaceholder')}
        className="min-h-[44px] flex-1 resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
        }}
      />
      <Button type="submit" disabled={loading || !body.trim()}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {t('send')}
      </Button>
    </form>
  );
}
