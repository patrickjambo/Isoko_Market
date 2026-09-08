'use client';

import { useState } from 'react';
import { PencilLine, Upload, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CvBuilder } from '@/components/cv/cv-builder';
import { DocumentManager } from '@/components/cv/document-manager';
import type { CvData } from '@/lib/validators/cv';

type Mode = 'build' | 'upload';

/**
 * Two complementary ways to be ready to apply — a structured Isoko CV AND/OR
 * uploaded documents. NOT mutually exclusive (like LinkedIn/Indeed: a profile
 * plus a reusable document library). Both persist on the seeker's profile and
 * are shown to every employer they apply to, so nothing is uploaded twice.
 */
export function CvChoice({
  initial,
  fullName,
  initialMode,
  hasCv,
  docCount,
}: {
  initial: CvData | null;
  fullName: string;
  initialMode: Mode;
  hasCv: boolean;
  docCount: number;
}) {
  const t = useTranslations('cv');
  const [mode, setMode] = useState<Mode>(initialMode);

  const cards: {
    key: Mode;
    label: string;
    hint: string;
    icon: typeof PencilLine;
    status?: string;
  }[] = [
    {
      key: 'build',
      label: t('tabBuild'),
      hint: t('tabBuildHint'),
      icon: PencilLine,
      status: hasCv ? t('cvCreated') : undefined,
    },
    {
      key: 'upload',
      label: t('tabUpload'),
      hint: t('tabUploadHint'),
      icon: Upload,
      status: docCount > 0 ? t('docsUploadedCount', { count: docCount }) : undefined,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2" aria-label={t('choiceTitle')}>
        {cards.map((card) => {
          const Icon = card.icon;
          const active = mode === card.key;
          return (
            <button
              key={card.key}
              type="button"
              aria-pressed={active}
              onClick={() => setMode(card.key)}
              className={cn(
                'relative flex items-start gap-3 rounded-xl border p-4 text-left transition-colors',
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
                <p className="font-semibold">{card.label}</p>
                <p className="text-sm text-muted-foreground">{card.hint}</p>
                {card.status && (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {card.status}
                  </span>
                )}
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
