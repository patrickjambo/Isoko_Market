'use client';

import { useState, useEffect } from 'react';
import { BellRing, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import {
  isPushNotificationSupported,
  getNotificationPermissionState,
  subscribeToPushNotifications,
  getActivePushSubscription,
} from '@/lib/push-client';

export function PushBanner() {
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!isPushNotificationSupported()) return;
    if (sessionStorage.getItem('dismiss_push_banner')) return;

    const perm = getNotificationPermissionState();
    if (perm === 'denied') return;

    getActivePushSubscription().then((sub) => {
      if (!sub) {
        setVisible(true);
      }
    });
  }, []);

  async function handleEnable() {
    setEnabling(true);
    try {
      const res = await subscribeToPushNotifications();
      if (res.success) {
        setVisible(false);
        toast('Push notifications enabled! You will now receive alerts even when Zenova is closed.', 'success');
      } else {
        toast(res.error || 'Could not enable notifications', 'error');
      }
    } finally {
      setEnabling(false);
    }
  }

  function handleDismiss() {
    setVisible(false);
    sessionStorage.setItem('dismiss_push_banner', 'true');
  }

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BellRing className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Turn on lock screen alerts</p>
          <p className="text-xs text-muted-foreground">
            Get instant sounds and badges for new messages, orders, and listing updates.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={handleEnable} disabled={enabling} className="h-8 text-xs">
          {enabling ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Turn On'}
        </Button>
        <button
          onClick={handleDismiss}
          className="rounded p-1 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
