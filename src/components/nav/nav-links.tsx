'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', key: 'home', exact: true },
  { href: '/marketplace', key: 'marketplace' },
  { href: '/jobs', key: 'jobs' },
] as const;

export function DesktopNavLinks() {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
      {LINKS.map((link) => {
        const active =
          'exact' in link && link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
              active
                ? 'bg-secondary text-primary'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            {t(link.key)}
          </Link>
        );
      })}
    </nav>
  );
}
