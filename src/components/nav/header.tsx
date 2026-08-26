import { Search } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { SearchBar } from './search-bar';
import { DesktopNavLinks } from './nav-links';
import { LocaleSwitcher } from './locale-switcher';
import { PostMenu } from './post-menu';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';

export async function Header() {
  const t = await getTranslations('nav');
  const tc = await getTranslations('common');
  const user = await getCurrentUser();

  const unread = user
    ? await prisma.notification.count({ where: { userId: user.id, readAt: null } })
    : 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center gap-3">
        <Link href="/" aria-label="Isoko Market home" className="shrink-0">
          <Logo />
        </Link>

        <DesktopNavLinks />

        <div className="ml-auto hidden max-w-md flex-1 lg:block">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-1 lg:ml-3">
          {/* Search reachable in one tap on mobile (Section 8.2) */}
          <Button variant="ghost" size="icon" asChild aria-label={tc('search')} className="lg:hidden">
            <Link href="/marketplace">
              <Search className="h-5 w-5" />
            </Link>
          </Button>
          <LocaleSwitcher />
          {user ? (
            <>
              <div className="hidden sm:block">
                <PostMenu />
              </div>
              <NotificationBell initialUnread={unread} />
              <UserMenu />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">{t('login')}</Link>
              </Button>
              <Button variant="default" size="sm" asChild>
                <Link href="/register">{t('register')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
