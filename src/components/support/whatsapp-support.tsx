'use client';

import { ShieldCheck, HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';

// Direct WhatsApp link to support — Russian WhatsApp number: +7 936 529-94-65
const WHATSAPP_URL = `https://wa.me/79365299465?text=${encodeURIComponent(
  'Hello Zenova Support, I need help or more information.'
)}`;

/**
 * Dedicated Help & Support section placed between main content and footer.
 * Directs users with questions, issues, or needing more information directly to WhatsApp.
 * Number is hidden from UI per specification — clicking automatically opens the chat.
 */
export function WhatsAppHelpBanner() {
  const t = useTranslations('community');

  return (
    <section className="border-t border-border bg-gradient-to-r from-emerald-50/70 via-background to-teal-50/70 py-10 transition-colors">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-white/95 p-6 shadow-sm sm:p-9 backdrop-blur-sm">
          {/* Subtle decorative glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-emerald-500/10 blur-2xl"
          />

          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            {/* Left side: Official WhatsApp Logo + Clear readable text */}
            <div className="flex items-start gap-4 sm:gap-5 max-w-2xl">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-md shadow-emerald-500/20 transition-transform hover:scale-105">
                <WhatsAppIcon className="h-8 w-8" />
              </div>
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 px-3 py-1 text-xs font-semibold text-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{t('helpBadge')}</span>
                </div>
                <h3 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                  {t('helpSectionTitle')}
                </h3>
                <p className="text-sm font-normal text-slate-600 sm:text-base leading-relaxed">
                  {t('helpSectionSubtitle')}
                </p>
              </div>
            </div>

            {/* Right side: Action button with official logo — NO number displayed */}
            <div className="w-full shrink-0 sm:w-auto">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] px-6 py-3.5 text-base font-bold text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-[#1ebe5d] hover:shadow-lg hover:shadow-emerald-600/30 active:scale-95 sm:w-auto"
              >
                <WhatsAppIcon className="h-5 w-5" />
                <span>{t('whatsappCta')}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Floating WhatsApp button with official logo.
 * Offset from bottom to clear mobile bottom tab bar (`bottom-20 md:bottom-6`).
 */
export function WhatsAppFloatingButton() {
  const t = useTranslations('community');

  return (
    <aside
      aria-label="WhatsApp Support"
      className="fixed bottom-20 right-4 z-40 flex items-center md:bottom-6 md:right-6"
    >
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('whatsappFloatingTooltip')}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-emerald-950/20 transition-all duration-300 hover:scale-110 hover:bg-[#1ebe5d] active:scale-95"
      >
        <WhatsAppIcon className="h-8 w-8" />

        {/* Pulse halo animation */}
        <span
          aria-hidden
          className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366] opacity-35 duration-1000"
        />

        {/* Desktop hover tooltip */}
        <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 md:inline-block">
          {t('whatsappFloatingTooltip')}
        </span>
      </a>
    </aside>
  );
}
