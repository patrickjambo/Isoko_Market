'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Clock, AlertTriangle, X, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

const SESSION_KEY = 'zenova_verify_nudge_dismissed';

/**
 * Site-wide, session-dismissible banner that prompts unverified users to
 * upload their National ID. Shown for UNVERIFIED and REJECTED users (prominent
 * warning style) and for PENDING users (softer info style).
 *
 * Uses sessionStorage so it re-appears each browser session, keeping the
 * gentle pressure on without being permanently annoying. Hides for VERIFIED.
 */
export function VerificationNudge({
  verificationStatus,
}: {
  verificationStatus: VerificationStatus;
}) {
  const t = useTranslations('verification');
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Never show for verified users.
    if (verificationStatus === 'VERIFIED') return;
    // Session-based dismissal: re-appears next session.
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    setShow(true);
  }, [verificationStatus]);

  if (!show || verificationStatus === 'VERIFIED') return null;

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, '1');
    setShow(false);
  }

  if (verificationStatus === 'PENDING') {
    return (
      <div className="container pt-3">
        <div className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <Clock className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{t('nudgePendingTitle')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('nudgePendingBody')}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('nudgeDismiss')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'REJECTED') {
    return (
      <div className="container pt-3">
        <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{t('nudgeRejectedTitle')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('nudgeRejectedBody')}</p>
            <Link
              href="/verify"
              onClick={dismiss}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-destructive hover:underline"
            >
              {t('nudgeRejectedCta')} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t('nudgeDismiss')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // UNVERIFIED — most prominent call-to-action
  return (
    <div className="container pt-3">
      <div className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">{t('nudgeTitle')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('nudgeBody')}</p>
          <Link
            href="/verify"
            onClick={dismiss}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {t('nudgeCta')} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('nudgeDismiss')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
