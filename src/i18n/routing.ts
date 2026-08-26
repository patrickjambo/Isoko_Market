import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

/**
 * Locale-based routing: /rw, /en, /fr (Section 4.1).
 * Kinyarwanda is the default locale per the "local language parity" principle
 * (Section 3) — it is NOT a fallback, all three catalogs are complete.
 */
export const routing = defineRouting({
  locales: ['rw', 'en', 'fr'] as const,
  defaultLocale: 'rw',
  localePrefix: 'always',
});

export type AppLocale = (typeof routing.locales)[number];

export const localeNames: Record<AppLocale, string> = {
  rw: 'Kinyarwanda',
  en: 'English',
  fr: 'Français',
};

// Locale-aware navigation helpers (drop-in replacements for next/link etc.)
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
