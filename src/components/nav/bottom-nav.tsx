'use client';

import { Home, Store, Briefcase, MessageCircle, User, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { useSession } from '@/components/providers';

const TABS = [
  { href: '/', key: 'home', icon: Home, exact: true, feature: null },
  { href: '/marketplace', key: 'marketplace', icon: Store, feature: null },
  { href: '/post', key: 'post', icon: Plus, center: true, feature: null },
  { href: '/jobs', key: 'jobs', icon: Briefcase, feature: 'jobs' as const },
  { href: '/messages', key: 'messages', icon: MessageCircle, auth: true, feature: null },
  { href: '/profile', key: 'profile', icon: User, auth: true, feature: null },
] as const;

/**
 * Mobile bottom tab bar (Section 8.2). A prominent central "+ Post" merges the
 * commerce and employment paths under one entry point.
 * Tabs gated by disabled feature flags are hidden automatically.
 */
export function BottomNav({ jobsEnabled = true }: { jobsEnabled?: boolean }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const user = useSession();

  const featureOn: Record<string, boolean> = { jobs: jobsEnabled };

  const tabs = TABS.filter((tab) => {
    if ('auth' in tab && tab.auth && !user) return false;
    if ('feature' in tab && tab.feature && !featureOn[tab.feature]) return false;
    return true;
  });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Primary mobile"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {tabs.map((tab) => {
          const active =
            'exact' in tab && tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          if ('center' in tab && tab.center) {
            return (
              <li key={tab.href} className="flex items-center">
                <Link
                  href={tab.href}
                  aria-label={t('post')}
                  className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg"
                >
                  <Icon className="h-6 w-6" />
                </Link>
              </li>
            );
          }
          return (
            <li key={tab.href} className="min-w-0 flex-1">
              <Link
                href={tab.href}
                className={cn(
                  'flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium sm:text-[11px]',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={cn('h-5 w-5 shrink-0', active && 'text-primary')} />
                <span className="max-w-full truncate px-0.5 text-center leading-tight">
                  {t(tab.key)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
