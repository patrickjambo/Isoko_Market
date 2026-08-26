'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, Loader2, ShieldCheck, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

type Status = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export function VerifyForm({ status }: { status: Status }) {
  const t = useTranslations('verification');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'VERIFIED') {
    return (
      <StatusPanel
        icon={CheckCircle2}
        tone="success"
        title={t('statusVerified')}
      />
    );
  }
  if (status === 'PENDING') {
    return <StatusPanel icon={Clock} tone="muted" title={t('statusPending')} />;
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setPreview(URL.createObjectURL(file));
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('private', 'true'); // ID docs are private (Section 10)
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'error');
      setDocUrl(data.url);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'error', 'error');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!docUrl) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idDocumentUrl: docUrl }),
      });
      if (!res.ok) throw new Error();
      toast(t('statusPending'), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {status === 'REJECTED' && (
        <StatusPanel icon={AlertTriangle} tone="destructive" title={t('statusRejected')} />
      )}

      <div className="rounded-xl border border-border bg-secondary/40 p-4">
        <div className="mb-2 flex items-center gap-2 font-semibold text-primary">
          <ShieldCheck className="h-5 w-5" /> {t('why')}
        </div>
        <p className="text-sm text-muted-foreground">{t('whyBody')}</p>
      </div>

      <ul className="space-y-2 text-sm">
        {[t('benefit1'), t('benefit2'), t('benefit3')].map((b) => (
          <li key={b} className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" /> {b}
          </li>
        ))}
      </ul>

      <div>
        <p className="mb-2 text-sm font-medium">{t('uploadLabel')}</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input p-6 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {preview ? (
            <div className="relative h-40 w-full max-w-xs overflow-hidden rounded-lg">
              <Image src={preview} alt="ID preview" fill className="object-contain" />
            </div>
          ) : uploading ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            <Upload className="h-8 w-8" />
          )}
          <span className="text-xs">{t('uploadHint')}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      <Button
        onClick={submit}
        disabled={!docUrl || submitting || uploading}
        size="lg"
        className="w-full"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? t('submitting') : t('submit')}
      </Button>

      <p className="text-center text-xs text-muted-foreground">{t('reducedVisibilityNote')}</p>
    </div>
  );
}

function StatusPanel({
  icon: Icon,
  tone,
  title,
}: {
  icon: typeof ShieldCheck;
  tone: 'success' | 'muted' | 'destructive';
  title: string;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-success/40 bg-success/10 text-success'
      : tone === 'destructive'
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : 'border-border bg-secondary/40 text-muted-foreground';
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${toneClass}`}>
      <Icon className="h-6 w-6 shrink-0" />
      <p className="font-medium">{title}</p>
    </div>
  );
}
