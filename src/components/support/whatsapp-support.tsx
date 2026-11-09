'use client';

import { MessageCircle, HelpCircle, PhoneCall, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

// WhatsApp number for support: +7 936 529-94-65 (Russian number)
const WHATSAPP_INTL_NUMBER = '79365299465';
const WHATSAPP_DISPLAY_NUMBER = '+7 936 529-94-65';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_INTL_NUMBER}?text=${encodeURIComponent(
  'Hello Zenova Support, I need help or more information.'
)}`;

/**
 * Dedicated Help & Support section for the landing page.
 * Directs users with questions, issues, or needing more information to WhatsApp.
 */
export function WhatsAppHelpBanner() {
  const t = useTranslations('community');

  return (
    <section className="border-t border-border bg-emerald-500/5 py-10 transition-colors">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-background to-teal-500/10 p-6 sm:p-10 shadow-sm">
          {/* Subtle decorative glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-2xl"
          />

          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            {/* Left side: Icon + Headings */}
            <div className="flex items-start gap-4 max-w-2xl">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-md shadow-emerald-500/20">
                <MessageCircle className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Direct WhatsApp Support</span>
                </div>
                <h3 className="text-xl font-bold tracking-tight sm:text-2xl text-foreground">
                  {t('helpSectionTitle')}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('helpSectionSubtitle')}
                </p>
                <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                  <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-medium text-foreground">{WHATSAPP_DISPLAY_NUMBER}</span>
                  <span>• Available for any inquiries & support</span>
                </div>
              </div>
            </div>

            {/* Right side: Action button */}
            <div className="w-full shrink-0 sm:w-auto">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-[#1ebe5d] hover:shadow-xl hover:shadow-emerald-500/30 active:scale-95 sm:w-auto"
              >
                <MessageCircle className="h-5 w-5" />
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
 * Floating WhatsApp button accessible across mobile and desktop.
 * Placed safely above the mobile bottom tab bar (bottom-20 on mobile, bottom-6 on desktop).
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
        className="group relative flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-900/20 transition-all duration-300 hover:scale-110 hover:bg-[#1ebe5d] hover:shadow-xl active:scale-95"
      >
        <MessageCircle className="h-7 w-7" />

        {/* Pulse effect */}
        <span
          aria-hidden
          className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366] opacity-30 duration-1000"
        />

        {/* Desktop hover tooltip */}
        <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg bg-foreground px-3 py-1.5 text-xs font-medium text-background opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100 md:inline-block">
          {t('whatsappFloatingTooltip')}
        </span>
      </a>
    </aside>
  );
}
