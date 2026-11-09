'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bell,
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

      // Natural delay of 3 seconds so user is engaged first
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
    if (loading) return;
    setLoading(true);

    try {
      // 1. Immediately request browser notification permission
      const permission = await Notification.requestPermission();

      // 2. Automatically and instantly close the modal the moment the user responds
      setOpen(false);

      if (permission === 'granted') {
        toast(t('promptSuccess'), 'success');

        // Complete the service worker and server push registration in the background
        subscribeToPushNotifications().catch(() => {});
      } else {
        snooze();
      }
    } catch {
      snooze();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? snooze() : setOpen(true))}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[360px] p-5 rounded-2xl border border-border bg-card shadow-xl sm:max-w-[360px]">
        {/* Close Button */}
        <button
          type="button"
          onClick={snooze}
          className="absolute right-3.5 top-3.5 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Compact Header with Icon Tile */}
        <div className="flex items-start gap-3 pt-0.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <DialogHeader className="space-y-0.5 text-left pr-4">
            <DialogTitle className="text-base font-semibold leading-tight text-foreground">
              {t('promptTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-snug">
              {t('promptSubtitle')}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Compact Benefit Highlights (Clean single-line rows) */}
        <div className="space-y-2 py-2">
          <div className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2 text-xs">
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="text-foreground font-medium truncate">
              {t('promptBenefitChatTitle')}
            </span>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2 text-xs">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="text-foreground font-medium truncate">
              {t('promptBenefitItemsTitle')}
            </span>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="text-foreground font-medium truncate">
              {t('promptBenefitOrdersTitle')}
            </span>
          </div>
        </div>

        {/* Compact Action Buttons */}
        <div className="flex flex-col gap-1.5 pt-1">
          <Button
            type="button"
            onClick={handleAllow}
            disabled={loading}
            className="w-full h-10 text-xs font-semibold gap-1.5 rounded-xl shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('promptEnabling')}
              </>
            ) : (
              <>
                <Bell className="h-3.5 w-3.5" />
                {t('promptAllowBtn')}
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={snooze}
            disabled={loading}
            className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            {t('promptLaterBtn')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
