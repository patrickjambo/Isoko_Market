import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an amount stored in RWF minor units (centimes) as Rwandan Francs.
 * We store money as integers to avoid floating-point drift on transactions.
 */
export function formatRWF(minorUnits: number, locale = 'rw'): string {
  const francs = Math.round(minorUnits / 100);
  const intlLocale = locale === 'rw' ? 'rw-RW' : locale === 'fr' ? 'fr-RW' : 'en-RW';
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: 'RWF',
      maximumFractionDigits: 0,
    }).format(francs);
  } catch {
    return `RWF ${francs.toLocaleString()}`;
  }
}

/** Convert whole francs (as entered by users) to stored minor units. */
export function francsToMinor(francs: number): number {
  return Math.round(francs * 100);
}

/** Relative "time ago" string with light locale support. */
export function timeAgo(date: Date | string, locale = 'en'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const divisions: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.34524, 'week'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ];
  let duration = seconds;
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) {
      return rtf.format(-Math.round(duration), unit);
    }
    duration /= amount;
  }
  return rtf.format(-Math.round(duration), 'year');
}

/** True if the user was active within the last 24 hours. */
export function isActiveToday(lastActiveAt: Date | string | null | undefined): boolean {
  if (!lastActiveAt) return false;
  const d = typeof lastActiveAt === 'string' ? new Date(lastActiveAt) : lastActiveAt;
  return Date.now() - d.getTime() < 24 * 60 * 60 * 1000;
}

/** URL-safe slug from a display name (used for white-label board URLs). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

/** Deterministic initials for avatar fallbacks. */
export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}
