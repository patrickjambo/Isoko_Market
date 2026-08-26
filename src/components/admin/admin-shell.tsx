'use client';

import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Flag,
  ShieldCheck,
  Users,
  Handshake,
  CreditCard,
  ShoppingBag,
  BarChart3,
  MessageSquareWarning,
  Languages,
  KeyRound,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'isoko_admin_sidebar_collapsed';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
  perm?: string; // required permission to see this item
};

export function AdminShell({
  counts,
  permissions,
  children,
}: {
  counts: { reports: number; verifications: number };
  permissions: string[];
  children: React.ReactNode;
}) {
  const can = (key?: string) => !key || permissions.includes(key);
  const t = useTranslations('admin');
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Restore the admin's saved sidebar preference after mount.
  useEffect(() => {
    setMounted(true);
    setCollapsed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  const items: NavItem[] = (
    [
      { href: '/admin', label: t('overview'), icon: LayoutDashboard, exact: true },
      { href: '/admin/users', label: t('users'), icon: Users, perm: 'users.view' },
      {
        href: '/admin/verifications',
        label: t('verifications'),
        icon: ShieldCheck,
        badge: counts.verifications,
        perm: 'verification.view',
      },
      {
        href: '/admin/moderation',
        label: t('moderation'),
        icon: Flag,
        badge: counts.reports,
        perm: 'moderation.view',
      },
      { href: '/admin/listings', label: t('cardListings'), icon: ShoppingBag, perm: 'listings.view' },
      { href: '/admin/transactions', label: t('transactions'), icon: CreditCard, perm: 'transactions.view' },
      { href: '/admin/analytics', label: t('analytics'), icon: BarChart3, perm: 'analytics.view' },
      { href: '/admin/messages', label: t('messagesOversight'), icon: MessageSquareWarning, perm: 'messages.oversight' },
      { href: '/admin/partners', label: t('partners'), icon: Handshake, perm: 'partners.view' },
      { href: '/admin/content', label: t('content'), icon: Languages, perm: 'content.view' },
      { href: '/admin/roles', label: t('rolesPanel'), icon: KeyRound, perm: 'roles.view' },
      { href: '/admin/audit', label: t('auditLog'), icon: ScrollText, perm: 'audit.view' },
    ] as NavItem[]
  ).filter((item) => can(item.perm));

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const NavList = ({ collapsedView }: { collapsedView: boolean }) => (
    <nav className="flex flex-col gap-1 p-2" aria-label="Admin">
      {items.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsedView ? item.label : undefined}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              collapsedView && 'justify-center px-0',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsedView && <span className="flex-1 truncate">{item.label}</span>}
            {item.badge ? (
              <span
                className={cn(
                  'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold',
                  collapsedView && 'absolute -right-0.5 -top-0.5 h-4 min-w-4',
                  active ? 'bg-primary-foreground text-primary' : 'bg-accent text-accent-foreground'
                )}
              >
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-[calc(100dvh-4rem)]">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 md:flex',
          mounted && collapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          {!collapsed && (
            <span className="text-sm font-semibold text-muted-foreground">{t('title')}</span>
          )}
          <button
            onClick={toggleCollapsed}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label={collapsed ? t('expandSidebar') : t('collapseSidebar')}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>
        <NavList collapsedView={mounted && collapsed} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-card shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-3">
              <span className="text-sm font-semibold">{t('title')}</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-secondary"
                aria-label={t('close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList collapsedView={false} />
          </aside>
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-secondary"
            aria-label={t('menu')}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-semibold">{t('title')}</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-success">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
            {t('live')}
          </span>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
