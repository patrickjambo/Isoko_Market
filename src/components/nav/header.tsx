import { Search, ShoppingBag } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCategories } from '@/lib/queries';
import { categoryName } from '@/lib/i18n-helpers';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { SearchBar } from './search-bar';
import { DesktopNavLinks } from './nav-links';
import { CategoriesMenu } from './categories-menu';
import { LocaleSwitcher } from './locale-switcher';
import { PostMenu } from './post-menu';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';

export async function Header() {
  const t = await getTranslations('nav');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const user = await getCurrentUser();

  const [unread, saved, categories] = await Promise.all([
    user
      ? prisma.notification.count({ where: { userId: user.id, readAt: null } })
      : Promise.resolve(0),
    user ? prisma.favorite.count({ where: { userId: user.id } }) : Promise.resolve(0),
    getCategories(),
  ]);

  const menuCategories = categories
    .filter((c) => c.kind === 'PRODUCT')
    .map((c) => ({ id: c.id, name: categoryName(c, locale) }));

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center gap-3">
        <Link href="/" aria-label="Zenova home" className="shrink-0">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <DesktopNavLinks />
          <CategoriesMenu categories={menuCategories} />
        </div>

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
              {/* Cart — products the buyer saved to buy later (the /saved list). */}
              <Button variant="ghost" size="icon" asChild aria-label={t('cart')} className="relative">
                <Link href="/saved">
                  <ShoppingBag className="h-5 w-5" />
                  {saved > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                      {saved > 99 ? '99+' : saved}
                    </span>
                  )}
                </Link>
              </Button>
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
