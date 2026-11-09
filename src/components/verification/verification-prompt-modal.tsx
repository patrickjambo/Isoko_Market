'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Lock,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useSession } from '@/components/providers';
import { useRouter, usePathname } from '@/i18n/routing';
import { useRealtime } from '@/hooks/use-realtime';
import {
  VERIFY_SNOOZE_KEY,
  VERIFY_SNOOZE_DURATION_MS,
  isVerificationPromptEligible,
  type VerificationStatus,
} from '@/lib/verification-prompt';

export { VERIFY_SNOOZE_KEY };

export function VerificationPromptModal() {
  const t = useTranslations('verification');
  const user = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<VerificationStatus>(
    (user?.verificationStatus as VerificationStatus) ?? 'UNVERIFIED'
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep status synced with session user
  useEffect(() => {
    if (user?.verificationStatus) {
      setStatus(user.verificationStatus as VerificationStatus);
    }
  }, [user?.verificationStatus]);

  // Check if modal should open
  const evaluateModalState = useCallback(() => {
    let snoozedUntil: number | null = null;
    try {
      const stored = localStorage.getItem(VERIFY_SNOOZE_KEY);
      if (stored) snoozedUntil = Number(stored);
    } catch {
      /* ignore storage error */
    }

    const eligible = isVerificationPromptEligible({
      isLoggedIn: Boolean(user),
      status,
      snoozedUntil,
      pathname,
    });

    if (!eligible) {
      setOpen(false);
      return;
    }

    // Open modal after brief natural delay (2.5 seconds)
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOpen(true);
    }, 2500);
  }, [user, status, pathname]);

  useEffect(() => {
    evaluateModalState();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [evaluateModalState]);

  // Real-time listener: instant dismissal when verified
  useRealtime(
    useCallback(
      (event) => {
        if (event.type === 'verification_updated') {
          setStatus(event.status);
          if (event.status === 'VERIFIED') {
            setOpen(false);
            toast(t('statusVerified'), 'success');
          } else if (event.status === 'PENDING') {
            setOpen(false);
          }
        } else if (
          event.type === 'notification' &&
          event.notification.type === 'VERIFICATION_APPROVED'
        ) {
          setStatus('VERIFIED');
          setOpen(false);
          toast(t('statusVerified'), 'success');
        }
      },
      [t, toast]
    ),
    Boolean(user)
  );

  // Background / focus poll for verification status
  useEffect(() => {
    if (!user || status === 'VERIFIED' || status === 'PENDING') return;

    async function checkVerification() {
      try {
        const res = await fetch('/api/verification');
        if (res.ok) {
          const data = await res.json();
          if (data?.status) {
            setStatus(data.status);
            if (data.status === 'VERIFIED' || data.status === 'PENDING') {
              setOpen(false);
            }
          }
        }
      } catch {
        /* ignore network hiccups */
      }
    }

    const onFocus = () => void checkVerification();
    window.addEventListener('focus', onFocus);
    const interval = setInterval(checkVerification, 30_000);

    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [user, status]);

  function handleRemindLater() {
    try {
      localStorage.setItem(VERIFY_SNOOZE_KEY, String(Date.now() + VERIFY_SNOOZE_DURATION_MS));
    } catch {
      /* ignore storage error */
    }
    setOpen(false);
    toast(t('remindLaterToast'), 'info');
  }

  function handleVerifyNow() {
    setOpen(false);
    router.push(`/verify?returnTo=${encodeURIComponent(pathname)}`);
  }

  // Never render if verified or pending
  if (status === 'VERIFIED' || status === 'PENDING') {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(val) => (!val ? handleRemindLater() : setOpen(true))}>
      <DialogContent className="w-[92vw] max-w-sm sm:max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl border-border bg-card">
        <DialogHeader className="flex flex-col items-center text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
            <ShieldCheck className="h-7 w-7" />
          </div>

          <div className="space-y-1">
            <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {t('modalTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
              {t('modalSubtitle')}
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Commercial trust benefits */}
        <div className="my-3 space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            <span className="text-foreground font-medium">{t('modalBenefit1')}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            <span className="text-foreground font-medium">{t('modalBenefit2')}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Lock className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">{t('modalBenefit3')}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <Button
            size="lg"
            className="w-full flex items-center justify-center gap-2 font-semibold shadow-sm"
            onClick={handleVerifyNow}
          >
            <ShieldCheck className="h-4 w-4" />
            {t('verifyNow')}
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center justify-center gap-1.5"
            onClick={handleRemindLater}
          >
            <Clock className="h-3.5 w-3.5" />
            {t('remindMeLater')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
