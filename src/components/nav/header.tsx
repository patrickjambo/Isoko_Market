import { Search, ShoppingBag } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCategories } from '@/lib/queries';
import { categoryName } from '@/lib/i18n-helpers';
import { getFeatureFlags } from '@/lib/feature-flags';
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

  const [unread, saved, categories, flags] = await Promise.all([
    user
      ? prisma.notification.count({ where: { userId: user.id, readAt: null } })
      : Promise.resolve(0),
    user ? prisma.favorite.count({ where: { userId: user.id } }) : Promise.resolve(0),
    getCategories(),
    getFeatureFlags(),
  ]);

  const productCategories = categories
    .filter((c) => c.kind === 'PRODUCT')
    .map((c) => ({ id: c.id, name: categoryName(c, locale) }));
  const serviceCategories = categories
    .filter((c) => c.kind === 'SERVICE')
    .map((c) => ({ id: c.id, name: categoryName(c, locale) }));

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <Link href="/" aria-label="Zenova home" className="shrink-0">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <DesktopNavLinks jobsEnabled={flags.jobsEnabled} />
          <CategoriesMenu products={productCategories} services={serviceCategories} variant="nav" />
        </div>

        <div className="ml-auto hidden max-w-md flex-1 lg:block">
          <SearchBar />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 lg:ml-3">
          {/* Categories reachable on mobile too — the desktop nav (with its text
              dropdown) is hidden below md, so surface a compact icon trigger. */}
          <CategoriesMenu
            products={productCategories}
            services={serviceCategories}
            variant="icon"
            className="md:hidden"
          />
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
                <PostMenu flags={flags} />
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
              <UserMenu flags={flags} />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="h-9 px-2 sm:px-3 text-xs sm:text-sm" asChild>
                <Link href="/login">{t('login')}</Link>
              </Button>
              <Button variant="default" size="sm" className="h-9 px-2.5 sm:px-3 text-xs sm:text-sm" asChild>
                <Link href="/register">{t('register')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
