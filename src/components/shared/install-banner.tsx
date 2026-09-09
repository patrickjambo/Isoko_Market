'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

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

/**
 * "Add Isoko to your home screen." Android/Chrome fires `beforeinstallprompt`, so
 * there we install in one tap. iOS/Safari never fires it (Apple only allows a
 * manual Add-to-Home-Screen), so iPhone users get the Share → Add to Home Screen
 * steps instead — otherwise install simply appears broken on iPhone.
 */
export function InstallBanner() {
  const t = useTranslations('common');
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;
    if (isStandalone()) return; // already installed

    // iOS can't be prompted programmatically — show manual steps instead.
    if (isIos()) {
      setIos(true);
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

  return (
    <div className="border-b border-border bg-secondary/60">
      <div className="container flex items-center gap-3 py-2">
        <Download className="h-4 w-4 shrink-0 text-primary" />
        {ios ? (
          // No one-tap install on iOS — spell out the Share → Add to Home Screen steps.
          <p className="min-w-0 flex-1 text-sm">
            {t('installIosBefore')}{' '}
            <Share className="mb-0.5 inline h-4 w-4 text-primary" aria-label="Share" />{' '}
            {t('installIosMiddle')}{' '}
            <Plus className="mb-0.5 inline h-4 w-4 text-primary" aria-hidden />
            <span className="font-medium">{t('installIosAdd')}</span>
            {t('installIosAfter')}
          </p>
        ) : (
          <>
            <p className="min-w-0 flex-1 truncate text-sm">{t('installBannerText')}</p>
            <button
              type="button"
              onClick={install}
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              {t('installApp')}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('dismiss')}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
