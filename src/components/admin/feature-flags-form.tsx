'use client';

import { useState, useTransition } from 'react';
import { Briefcase, FileText, Users, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { broadcastFeatureFlagChange } from '@/components/providers/feature-flags-provider';

type Flags = {
  jobsEnabled: boolean;
  hiringEnabled: boolean;
  cvBuilderEnabled: boolean;
};

type FeatureConfig = {
  key: keyof Flags;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
};

const FEATURES: FeatureConfig[] = [
  {
    key: 'jobsEnabled',
    icon: Briefcase,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  {
    key: 'hiringEnabled',
    icon: Users,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-950/40',
    borderColor: 'border-violet-200 dark:border-violet-800',
  },
  {
    key: 'cvBuilderEnabled',
    icon: FileText,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
];

export function FeatureFlagsForm({ initial }: { initial: Flags }) {
  const t = useTranslations('featureFlags');
  const router = useRouter();
  const [flags, setFlags] = useState<Flags>(initial);
  const [saving, setSaving] = useState<keyof Flags | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<keyof Flags | null>(null);
  const [_isPending, startTransition] = useTransition();

  async function toggle(key: keyof Flags) {
    const newValue = !flags[key];
    const optimistic = { ...flags, [key]: newValue };
    setFlags(optimistic);
    setError(null);
    setSaving(key);
    setLastSaved(null);

    try {
      const res = await fetch('/api/admin/settings/feature-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newValue }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? 'Failed to save');
      }

      const data = await res.json();
      setFlags(data.data);
      setLastSaved(key);
      broadcastFeatureFlagChange(data.data);
      startTransition(() => router.refresh());
      // Clear the "saved" indicator after 3 s
      setTimeout(() => setLastSaved(null), 3000);
    } catch (err) {
      // Revert optimistic update
      const reverted = { ...flags, [key]: !newValue };
      setFlags(reverted);
      broadcastFeatureFlagChange(reverted);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(null);
    }
  }

  const flagLabels: Record<keyof Flags, { label: string; description: string }> = {
    jobsEnabled: {
      label: t('jobsLabel'),
      description: t('jobsDesc'),
    },
    hiringEnabled: {
      label: t('hiringLabel'),
      description: t('hiringDesc'),
    },
    cvBuilderEnabled: {
      label: t('cvBuilderLabel'),
      description: t('cvBuilderDesc'),
    },
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ key, icon: Icon, color, bgColor, borderColor }) => {
          const enabled = flags[key];
          const isSaving = saving === key;
          const wasSaved = lastSaved === key;
          const { label, description } = flagLabels[key];

          return (
            <div
              key={key}
              className={`relative flex flex-col gap-4 rounded-xl border p-5 transition-all duration-200 ${
                enabled ? `${bgColor} ${borderColor}` : 'border-border bg-card'
              }`}
            >
              {/* Icon + status badge */}
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    enabled ? bgColor : 'bg-muted'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${enabled ? color : 'text-muted-foreground'}`} />
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    enabled
                      ? 'bg-success/15 text-success'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`}
                  />
                  {enabled ? t('statusOn') : t('statusOff')}
                </span>
              </div>

              {/* Label + description */}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{label}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
              </div>

              {/* Toggle button */}
              <button
                id={`flag-toggle-${key}`}
                onClick={() => toggle(key)}
                disabled={isSaving}
                aria-pressed={enabled}
                className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150 disabled:opacity-60 ${
                  enabled
                    ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : wasSaved ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : null}
                {isSaving
                  ? t('saving')
                  : enabled
                    ? t('disableBtn')
                    : t('enableBtn')}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {t('hint')}
      </p>
    </div>
  );
}
