'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

const STATUSES = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'INTERVIEW', 'HIRED', 'REJECTED'] as const;

/** Employer control to move an application through its lifecycle (Section 6.3). */
export function ApplicationStatusControl({
  applicationId,
  status,
}: {
  applicationId: string;
  status: string;
}) {
  const t = useTranslations('jobs.status');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    const prev = value;
    setValue(next);
    setSaving(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      toast(t(next), 'success');
      router.refresh();
    } catch {
      setValue(prev);
      toast(tc('error'), 'error');
    } finally {
      setSaving(false);
    }
  }

  // POSITION_FILLED is set by the cascade, never chosen — show it read-only.
  if (value === 'POSITION_FILLED') {
    return (
      <span className="inline-flex h-9 items-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">
        {t('POSITION_FILLED')}
      </span>
    );
  }

  return (
    <Select
      value={value}
      onChange={(e) => change(e.target.value)}
      disabled={saving}
      className="h-9 max-w-[170px] text-sm"
      aria-label="Application status"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(s)}
        </option>
      ))}
    </Select>
  );
}
