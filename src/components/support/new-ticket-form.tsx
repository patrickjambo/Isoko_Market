'use client';

import { useState } from 'react';
import { Loader2, LifeBuoy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { SUPPORT_CATEGORIES } from '@/lib/validators/support';

/** Open a new support ticket, then land on its thread. */
export function NewTicketForm() {
  const t = useTranslations('support');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<string>('OTHER');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (subject.trim().length < 3) return setError(t('errSubject'));
    if (message.trim().length < 5) return setError(t('errMessage'));
    setLoading(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), category, message: message.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error?.message ?? tc('error'));
      toast(t('created'), 'success');
      router.push(`/support/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : tc('error'));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-5">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="subject">{t('subjectLabel')}</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('subjectPlaceholder')}
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="category">{t('categoryLabel')}</Label>
        <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`category_${c}`)}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="message">{t('messageLabel')}</Label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={4000}
          placeholder={t('messagePlaceholder')}
          className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          required
        />
      </div>

      <Button type="submit" size="lg" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LifeBuoy className="h-4 w-4" />}
        {t('submit')}
      </Button>
    </form>
  );
}
