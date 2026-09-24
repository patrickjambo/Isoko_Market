'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share, Plus, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'isoko_install_dismissed';

/** Already running as an installed app? Then never nag to install. */
function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes this non-standard flag when launched from the home screen.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone/iPad — including iPadOS 13+, which masquerades as a Mac but has touch. */
function isIos() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iPhoneIsh = /iphone|ipad|ipod/i.test(ua);
  const iPadOs = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return iPhoneIsh || iPadOs;
}

/** iOS "Add to Home Screen" only works in Safari — not Chrome/Firefox/in-app. */
function isIosSafari() {
  if (!isIos()) return false;
  return !/crios|fxios|edgios|opios|mercury|brave|line|fban|fbav|instagram/i.test(
    window.navigator.userAgent
  );
}

/**
 * "Add Zenova to your home screen." Android/Chrome fires `beforeinstallprompt`, so
 * there we install in one tap. iOS never fires it (Apple only allows a manual
 * Add-to-Home-Screen from Safari), so on iPhone the button opens a short how-to
 * dialog instead — otherwise there is nothing to tap and install looks broken.
 */
export function InstallBanner() {
  const t = useTranslations('common');
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [safari, setSafari] = useState(true);
  const [howto, setHowto] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
    if (isStandalone()) return; // already installed

    // iOS can't be prompted programmatically — show manual steps instead.
    if (isIos()) {
      setIos(true);
      setSafari(isIosSafari());
      setHidden(false);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
      setIos(false); // a native prompt beats manual steps
      setHidden(false);
    };
    const onInstalled = () => {
      setHidden(true);
      localStorage.setItem(DISMISS_KEY, '1');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (hidden || (!evt && !ios)) return null;

  async function install() {
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    setEvt(null);
    setHidden(true);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  }

  const steps: { icon: typeof Share; text: string }[] = [
    { icon: Share, text: t('installIosStep1') },
    { icon: Plus, text: t('installIosStep2') },
    { icon: Check, text: t('installIosStep3') },
  ];

  return (
    <div className="border-b border-border bg-secondary/60">
      <div className="container flex items-center gap-3 py-2">
        <Download className="h-4 w-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 truncate text-sm">{t('installBannerText')}</p>
        <button
          type="button"
          onClick={ios ? () => setHowto(true) : install}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {ios ? t('installIosHow') : t('installApp')}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* iOS how-to: the actual install is a manual Safari action, so we guide it. */}
      <Dialog open={howto} onOpenChange={setHowto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('installIosTitle')}</DialogTitle>
            {!safari && (
              <DialogDescription className="font-medium text-destructive">
                {t('installIosSafariOnly')}
              </DialogDescription>
            )}
          </DialogHeader>
          <ol className="space-y-3">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <Icon className="h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm">{s.text}</span>
                </li>
              );
            })}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}
