'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { useFeatureFlags } from '@/components/providers';

const BASE_LINKS = [
  { href: '/', key: 'home', exact: true, feature: null },
  { href: '/marketplace', key: 'marketplace', feature: null },
  { href: '/jobs', key: 'jobs', feature: 'jobs' as const },
] as const;

type Feature = 'jobs' | null;

export function DesktopNavLinks({ jobsEnabled: initialJobsEnabled }: { jobsEnabled?: boolean }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const liveFlags = useFeatureFlags();

  const effectiveJobsEnabled = liveFlags?.jobsEnabled ?? initialJobsEnabled ?? false;
  const featureOn: Record<string, boolean> = { jobs: effectiveJobsEnabled };

  const links = BASE_LINKS.filter((l) => l.feature === null || featureOn[l.feature]);

  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
      {links.map((link) => {
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
