'use client';

import { useState } from 'react';
import { PencilLine, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CvBuilder } from '@/components/cv/cv-builder';
import { DocumentManager } from '@/components/cv/document-manager';
import type { CvData } from '@/lib/validators/cv';

type Mode = 'build' | 'upload';

/**
 * Lets a jobseeker pick ONE of two ways to have a CV an employer can read:
 *  - Build one with the structured builder, or
 *  - Upload a CV / documents they already have from their device.
 * Both persist and are surfaced to employers on apply — this is just the choice
 * of path, not two competing things to fill in.
 */
export function CvChoice({
  initial,
  fullName,
  initialMode,
}: {
  initial: CvData | null;
  fullName: string;
  initialMode: Mode;
}) {
  const t = useTranslations('cv');
  const [mode, setMode] = useState<Mode>(initialMode);

  const tabs: { key: Mode; label: string; hint: string; icon: typeof PencilLine }[] = [
    { key: 'build', label: t('tabBuild'), hint: t('tabBuildHint'), icon: PencilLine },
    { key: 'upload', label: t('tabUpload'), hint: t('tabUploadHint'), icon: Upload },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2" role="tablist" aria-label={t('choiceTitle')}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = mode === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(tab.key)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                active
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:bg-secondary'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold">{tab.label}</p>
                <p className="text-sm text-muted-foreground">{tab.hint}</p>
              </div>
            </button>
          );
        })}
      </div>

      {mode === 'build' ? (
        <CvBuilder initial={initial} fullName={fullName} />
      ) : (
        <DocumentManager />
      )}
    </div>
  );
}
