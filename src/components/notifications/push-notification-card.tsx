'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  MessageSquare,
  ShoppingBag,
  Briefcase,
  ShieldCheck,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Smartphone,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  isPushNotificationSupported,
  getNotificationPermissionState,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getActivePushSubscription,
} from '@/lib/push-client';

interface Preferences {
  pushEnabled: boolean;
  notifyMessages: boolean;
  notifyOrders: boolean;
  notifyListings: boolean;
  notifyJobs: boolean;
  notifySystem: boolean;
}

export function PushNotificationCard() {
  const { toast } = useToast();
  const [supported, setSupported] = useState<boolean>(true);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [subscribing, setSubscribing] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  const [prefs, setPrefs] = useState<Preferences>({
    pushEnabled: true,
    notifyMessages: true,
    notifyOrders: true,
    notifyListings: true,
    notifyJobs: true,
    notifySystem: true,
  });

  useEffect(() => {
    const isSup = isPushNotificationSupported();
    setSupported(isSup);
    if (!isSup) {
      setLoading(false);
      return;
    }

    setPermission(getNotificationPermissionState());

    // Load active subscription status and server preferences
    async function init() {
      try {
        const [activeSub, res] = await Promise.all([
          getActivePushSubscription(),
          fetch('/api/push/preferences').then((r) => (r.ok ? r.json() : null)),
        ]);

        setIsSubscribed(Boolean(activeSub));

        if (res?.preferences) {
          setPrefs({
            pushEnabled: res.preferences.pushEnabled ?? true,
            notifyMessages: res.preferences.notifyMessages ?? true,
            notifyOrders: res.preferences.notifyOrders ?? true,
            notifyListings: res.preferences.notifyListings ?? true,
            notifyJobs: res.preferences.notifyJobs ?? true,
            notifySystem: res.preferences.notifySystem ?? true,
          });
        }
      } catch (err) {
        console.error('Failed to initialize push status:', err);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  async function handleToggleSubscribe() {
    if (subscribing) return;
    setSubscribing(true);

    try {
      if (isSubscribed) {
        const res = await unsubscribeFromPushNotifications();
        if (res.success) {
          setIsSubscribed(false);
          toast('Push notifications disabled on this device', 'info');
        } else {
          toast(res.error || 'Failed to disable notifications', 'error');
        }
      } else {
        const res = await subscribeToPushNotifications();
        if (res.success) {
          setIsSubscribed(true);
          setPermission('granted');
          toast('Push notifications activated! You will receive alerts even when app is closed.', 'success');
        } else {
          setPermission(getNotificationPermissionState());
          toast(res.error || 'Failed to activate notifications', 'error');
        }
      }
    } finally {
      setSubscribing(false);
    }
  }

  async function handleTogglePref(key: keyof Preferences) {
    const nextVal = !prefs[key];
    const nextPrefs = { ...prefs, [key]: nextVal };
    setPrefs(nextPrefs);

    startTransition(async () => {
      try {
        const res = await fetch('/api/push/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: nextVal }),
        });
        if (!res.ok) {
          setPrefs(prefs); // rollback on error
          toast('Failed to save preference', 'error');
        }
      } catch {
        setPrefs(prefs);
        toast('Network error saving preference', 'error');
      }
    });
  }

  async function handleSendTest() {
    if (testing) return;
    setTesting(true);

    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast('Test notification sent! Check your phone lock screen or notification panel 🎉', 'success');
      } else {
        toast(data.message || 'Failed to send test notification', 'error');
      }
    } catch {
      toast('Network error sending test notification', 'error');
    } finally {
      setTesting(false);
    }
  }

  if (!supported) {
    return (
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <BellOff className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Push Notifications</CardTitle>
              <CardDescription>Instant alerts on lock screens and watches</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              Push notifications are not supported in this browser mode. On iPhone/iPad, tap Share → <strong>Add to Home Screen</strong> to enable native lock screen notifications.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isSubscribed ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}
            >
              {isSubscribed ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Real-time Push Notifications</CardTitle>
                {isSubscribed ? (
                  <Badge variant="success" className="gap-1 text-[11px] px-2 py-0.5">
                    <CheckCircle2 className="h-3 w-3" /> Active
                  </Badge>
                ) : permission === 'denied' ? (
                  <Badge variant="destructive" className="gap-1 text-[11px] px-2 py-0.5">
                    <AlertCircle className="h-3 w-3" /> Blocked
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px] px-2 py-0.5 text-muted-foreground">
                    Off
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs mt-0.5">
                Instant delivery to lock screen and notification bar like WhatsApp & YouTube
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {permission === 'denied' && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Notifications are currently blocked in your browser settings. Please allow notifications for this site to receive alerts.
            </span>
          </div>
        )}

        {/* Master activation button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/30 p-3.5">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Device Push Alerts</p>
              <p className="text-xs text-muted-foreground">
                {isSubscribed
                  ? 'This device is receiving background notifications'
                  : 'Receive sounds and banners even when Zenova is closed'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isSubscribed ? 'outline' : 'default'}
              size="sm"
              disabled={loading || subscribing}
              onClick={handleToggleSubscribe}
              className="w-full sm:w-auto"
            >
              {subscribing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Updating...
                </>
              ) : isSubscribed ? (
                'Disable on Device'
              ) : (
                'Enable on Device'
              )}
            </Button>
            {isSubscribed && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={testing}
                onClick={handleSendTest}
                className="gap-1.5 shrink-0"
                title="Send test push to phone"
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Test Push</span>
              </Button>
            )}
          </div>
        </div>

        {/* Notification Category Preferences */}
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Notification Categories
          </p>

          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {/* Chat & Messages */}
            <label className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Chat & Messages</p>
                  <p className="text-xs text-muted-foreground">Instant messages from buyers, sellers, and contacts</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.notifyMessages}
                onChange={() => handleTogglePref('notifyMessages')}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
            </label>

            {/* Orders & Payments */}
            <label className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium">Orders & Payments</p>
                  <p className="text-xs text-muted-foreground">Order updates, escrow releases, and wallet top-ups</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.notifyOrders}
                onChange={() => handleTogglePref('notifyOrders')}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
            </label>

            {/* Listings & Services */}
            <label className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Listings & Favorites</p>
                  <p className="text-xs text-muted-foreground">New offers, favorited items, and sold notifications</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.notifyListings}
                onChange={() => handleTogglePref('notifyListings')}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
            </label>

            {/* Jobs & Applications */}
            <label className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-sm font-medium">Jobs & Applications</p>
                  <p className="text-xs text-muted-foreground">Candidate applications, interview updates, and status changes</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.notifyJobs}
                onChange={() => handleTogglePref('notifyJobs')}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
            </label>

            {/* System & Identity Verification */}
            <label className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/40 transition-colors">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                <div>
                  <p className="text-sm font-medium">Security & Account</p>
                  <p className="text-xs text-muted-foreground">ID verification results, subscription alerts, and security</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={prefs.notifySystem}
                onChange={() => handleTogglePref('notifySystem')}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
