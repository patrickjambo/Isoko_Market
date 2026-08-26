import { notFound } from 'next/navigation';

/**
 * Catch-all for unmatched localized routes. It renders the localized
 * not-found.tsx (within the [locale] layout, so i18n + chrome work), which is
 * the next-intl-recommended way to get proper 404s without a root layout.
 */
export default function CatchAllPage() {
  notFound();
}
