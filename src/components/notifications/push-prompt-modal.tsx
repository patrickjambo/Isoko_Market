'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  BellRing,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Loader2,
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
import {
  isPushNotificationSupported,
  getNotificationPermissionState,
  subscribeToPushNotifications,
  getActivePushSubscription,
} from '@/lib/push-client';

const SNOOZE_KEY = 'zenova_push_prompt_snoozed_until';
const SNOOZE_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export function PushPromptModal() {
  const t = useTranslations('notifications');
  const user = useSession();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only prompt authenticated users who haven't subscribed or snoozed
    if (!user) return;
    if (!isPushNotificationSupported()) return;

    const permission = getNotificationPermissionState();
    if (permission === 'granted' || permission === 'denied') return;

    // Check if prompt was recently snoozed
    try {
      const snoozedUntil = localStorage.getItem(SNOOZE_KEY);
      if (snoozedUntil && Number(snoozedUntil) > Date.now()) {
        return;
      }
    } catch {
      /* ignore storage access error */
    }

    let isMounted = true;

    // Check if the device is already subscribed
    getActivePushSubscription().then((sub) => {
      if (!isMounted) return;
      if (sub) return;

      // Natural delay of 3 seconds so the user is engaged with the page first
      const timer = setTimeout(() => {
        if (isMounted) setOpen(true);
      }, 3000);

      return () => clearTimeout(timer);
    });

    return () => {
      isMounted = false;
    };
  }, [user]);

  function snooze() {
    setOpen(false);
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DURATION_MS));
    } catch {
      /* ignore storage error */
    }
  }

  async function handleAllow() {
    setLoading(true);
    try {
      const res = await subscribeToPushNotifications();
      if (res.success) {
        setOpen(false);
        toast(t('promptSuccess'), 'success');
      } else {
        snooze();
        if (res.error && !res.error.includes('dismissed')) {
          toast(res.error, 'error');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? snooze() : setOpen(true))}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border border-border shadow-2xl sm:max-w-md">
        {/* Header with Zenova Brand Gradient */}
        <div className="relative bg-gradient-to-br from-primary via-primary/95 to-accent p-6 text-white text-center">
          <button
            type="button"
            onClick={snooze}
            className="absolute right-4 top-4 rounded-full p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Animated Bell Tile */}
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md ring-8 ring-white/10 shadow-inner">
            <BellRing className="h-8 w-8 text-white animate-bounce" style={{ animationDuration: '2s' }} />
          </div>

          <DialogHeader className="space-y-1 text-center">
            <DialogTitle className="text-xl font-bold text-white tracking-tight">
              {t('promptTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/85 max-w-xs mx-auto leading-relaxed">
              {t('promptSubtitle')}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Real-time Benefits List */}
        <div className="p-5 space-y-3.5 bg-card">
          {/* Chat Messages */}
          <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-2.5 transition-colors">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t('promptBenefitChatTitle')}
              </p>
              <p className="text-xs text-muted-foreground leading-snug">
                {t('promptBenefitChatDesc')}
              </p>
            </div>
          </div>

          {/* New Items & Deals */}
          <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-2.5 transition-colors">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent mt-0.5">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t('promptBenefitItemsTitle')}
              </p>
              <p className="text-xs text-muted-foreground leading-snug">
                {t('promptBenefitItemsDesc')}
              </p>
            </div>
          </div>

          {/* Orders & Payments */}
          <div className="flex items-start gap-3 rounded-xl bg-muted/40 p-2.5 transition-colors">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 mt-0.5">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t('promptBenefitOrdersTitle')}
              </p>
              <p className="text-xs text-muted-foreground leading-snug">
                {t('promptBenefitOrdersDesc')}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <Button
              type="button"
              onClick={handleAllow}
              disabled={loading}
              className="w-full h-11 text-sm font-semibold gap-2 shadow-md"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('promptEnabling')}
                </>
              ) : (
                <>
                  <BellRing className="h-4 w-4" />
                  {t('promptAllowBtn')}
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={snooze}
              disabled={loading}
              className="w-full h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              {t('promptLaterBtn')}
            </Button>
          </div>

          {/* Footer reassurance note */}
          <p className="text-center text-[11px] text-muted-foreground/80 px-2">
            {t('promptFooterNote')}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
