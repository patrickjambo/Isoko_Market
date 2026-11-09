'use client';

import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import {
  Upload,
  Loader2,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ShoppingBag,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useRealtime } from '@/hooks/use-realtime';
import { VERIFY_SNOOZE_KEY, VERIFY_SNOOZE_DURATION_MS } from '@/lib/verification-prompt';

type Status = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export function VerifyForm({ status, returnTo }: { status: Status; returnTo?: string }) {
  const t = useTranslations('verification');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [localStatus, setLocalStatus] = useState<Status>(status);
  const [preview, setPreview] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sync if status prop changes from server
  useEffect(() => {
    setLocalStatus(status);
  }, [status]);

  // Real-time listener: instantly update status if verified while on the page
  useRealtime((event) => {
    if (event.type === 'verification_updated') {
      setLocalStatus(event.status);
    }
    if (event.type === 'notification' && event.notification.type === 'VERIFICATION_APPROVED') {
      setLocalStatus('VERIFIED');
    }
  });

  function handleRemindLater() {
    try {
      localStorage.setItem(VERIFY_SNOOZE_KEY, String(Date.now() + VERIFY_SNOOZE_DURATION_MS));
    } catch {
      /* ignore storage error */
    }
    toast(t('remindLaterToast'), 'info');
    const target = (returnTo && returnTo !== '/verify' ? returnTo : '/') as Parameters<typeof router.push>[0];
    router.push(target);
  }

  if (localStatus === 'VERIFIED') {
    return <VerifiedRedirectCard returnTo={returnTo} />;
  }

  if (localStatus === 'PENDING') {
    return <PendingRedirectCard returnTo={returnTo} />;
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
      setDocUrl(null);
      // Immediately switch to the pending redirect card so they see confirmation
      // and are auto-redirected to home / return destination without getting stuck.
      setLocalStatus('PENDING');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {localStatus === 'REJECTED' && (
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

      <div className="space-y-2.5">
        <Button
          onClick={submit}
          disabled={!docUrl || submitting || uploading}
          size="lg"
          className="w-full"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? t('submitting') : t('submit')}
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full flex items-center justify-center gap-2"
          onClick={handleRemindLater}
        >
          <Clock className="h-4 w-4 text-muted-foreground" />
          {t('remindMeLater')}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">{t('reducedVisibilityNote')}</p>
    </div>
  );
}

function PendingRedirectCard({ returnTo }: { returnTo?: string }) {
  const t = useTranslations('verification');
  const router = useRouter();
  const [countdown, setCountdown] = useState(4);
  const target = (returnTo && returnTo !== '/verify' ? returnTo : '/') as Parameters<typeof router.push>[0];

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(target);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router, target]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/5 p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
          <Clock className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {t('statusPendingTitle')}
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t('pendingNotice')}
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-full border border-blue-200 bg-blue-100/60 px-3.5 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{t('autoRedirectCountdown', { seconds: countdown })}</span>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row w-full max-w-sm gap-3">
          <Button
            className="flex-1"
            size="lg"
            onClick={() => router.push(target)}
          >
            {t('goToHome')} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => router.push('/dashboard/sell')}
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            {t('continueSelling')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function VerifiedRedirectCard({ returnTo }: { returnTo?: string }) {
  const t = useTranslations('verification');
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);
  const target = (returnTo && returnTo !== '/verify' ? returnTo : '/') as Parameters<typeof router.push>[0];

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(target);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router, target]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-success/30 bg-success/5 p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          {t('statusVerified')}
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {t('verifiedNotice')}
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3.5 py-1 text-xs font-medium text-success">
          <span>{t('autoRedirectCountdown', { seconds: countdown })}</span>
        </div>

        <div className="mt-6 w-full max-w-xs">
          <Button
            className="w-full"
            size="lg"
            onClick={() => router.push(target)}
          >
            {t('goToHome')} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
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
