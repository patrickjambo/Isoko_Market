'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Lightweight job-type toggle chips (Section 8.3 — same feed pattern as market). */
export function JobFilters({ current }: { current: Record<string, string | undefined> }) {
  const t = useTranslations('jobs');
  const tc = useTranslations('common');
  const router = useRouter();
  const activeType = current.type;

  function setType(type?: 'JOB' | 'GIG') {
    const sp = new URLSearchParams();
    if (current.q) sp.set('q', current.q);
    if (current.location) sp.set('location', current.location);
    if (type) sp.set('type', type);
    router.push(`/jobs?${sp.toString()}`);
  }

  const chips: { label: string; value?: 'JOB' | 'GIG' }[] = [
    { label: tc('all'), value: undefined },
    { label: t('typeJob'), value: 'JOB' },
    { label: t('typeGig'), value: 'GIG' },
  ];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('type')}>
      {chips.map((chip) => {
        const active = activeType === chip.value || (!activeType && !chip.value);
        return (
          <Button
            key={chip.label}
            variant={active ? 'default' : 'outline'}
            size="sm"
            onClick={() => setType(chip.value)}
            className={cn(!active && 'text-muted-foreground')}
          >
            {chip.label}
          </Button>
        );
      })}
    </div>
  );
}
