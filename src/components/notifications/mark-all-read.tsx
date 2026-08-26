'use client';

import { CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';

export function MarkAllReadButton() {
  const t = useTranslations('notifications');
  const router = useRouter();

  async function markAll() {
    await fetch('/api/notifications/read', { method: 'POST' });
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={markAll}>
      <CheckCheck className="h-4 w-4" /> {t('markAllRead')}
    </Button>
  );
}
