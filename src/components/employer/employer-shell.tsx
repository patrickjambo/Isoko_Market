'use client';

import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  MessageCircle,
  User,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'isoko_employer_sidebar_collapsed';

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: number };

/**
 * Collapsible, persisted employer sidebar (§1) — Home · My Jobs · Applicants ·
 * Messages · Company Profile, with an always-reachable "+ Post a Job". Mirrors
 * the seller shell exactly so an employer who has also sold feels no relearning.
 */
export function EmployerShell({
  unread,
  newApplicants,
  children,
}: {
  unread: number;
  newApplicants: number;
  children: React.ReactNode;
}) {
  const t = useTranslations('employer');
  const tn = useTranslations('nav');
  const ta = useTranslations('admin');
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  const items: NavItem[] = [
    { href: '/employer', label: t('home'), icon: LayoutDashboard, exact: true },
    { href: '/employer/jobs', label: t('myJobs'), icon: Briefcase },
    { href: '/employer/applicants', label: t('applicants'), icon: Users, badge: newApplicants },
    { href: '/messages', label: tn('messages'), icon: MessageCircle, badge: unread },
    { href: '/profile', label: t('companyProfile'), icon: User },
  ];
  const isActive = (i: NavItem) => (i.exact ? pathname === i.href : pathname.startsWith(i.href));

  const Body = ({ mini }: { mini: boolean }) => (
    <>
      <div className="p-2">
        <Link
          href="/jobs/new"
          title={mini ? t('postJob') : undefined}
          className={cn(
            'flex h-11 items-center gap-2 rounded-lg bg-accent px-3 font-semibold text-accent-foreground shadow-sm hover:bg-accent/90',
            mini && 'justify-center px-0'
          )}
        >
          <Plus className="h-5 w-5 shrink-0" />
          {!mini && <span>{t('postJob')}</span>}
        </Link>
      </div>
      <nav className="flex flex-col gap-1 p-2" aria-label="Employer">
        {items.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={mini ? item.label : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                mini && 'justify-center px-0',
                active
                  ? 'bg-secondary text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!mini && <span className="flex-1 truncate">{item.label}</span>}
              {item.badge ? (
                <span
                  className={cn(
                    'flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-accent-foreground',
                    mini && 'absolute -right-0.5 -top-0.5 h-4 min-w-4'
                  )}
                >
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );

  const mini = mounted && collapsed;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)]">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 md:flex',
          mini ? 'w-16' : 'w-60'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          {!collapsed && (
            <span className="text-sm font-semibold text-muted-foreground">{t('dashboard')}</span>
          )}
          <button
            onClick={toggle}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={collapsed ? ta('expandSidebar') : ta('collapseSidebar')}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>
        <Body mini={mini} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-card shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-3">
              <span className="text-sm font-semibold">{t('dashboard')}</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-secondary"
                aria-label={ta('close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Body mini={false} />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-secondary"
            aria-label={ta('menu')}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">{t('dashboard')}</span>
        </div>
        <div className="container max-w-4xl p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
