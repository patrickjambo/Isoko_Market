'use client';

import { ChevronDown, LayoutGrid, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Category = { id: string; name: string };

/**
 * Header "Categories" dropdown — the marketplace browse categories, moved out of
 * the homepage strip so they're reachable from every page. Products and services
 * are grouped; each item links to the same `/marketplace?…` filter as before, so
 * browsing works exactly as it did.
 *
 * `variant="nav"` renders the labelled text trigger for the desktop nav;
 * `variant="icon"` renders a compact icon button for the mobile header.
 */
export function CategoriesMenu({
  products,
  services,
  variant = 'nav',
  className,
}: {
  products: Category[];
  services: Category[];
  variant?: 'nav' | 'icon';
  className?: string;
}) {
  const t = useTranslations('nav');
  if (products.length === 0 && services.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('categories')}
        className={cn(
          'inline-flex items-center outline-none transition-colors',
          variant === 'nav'
            ? 'gap-1 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground'
            : 'h-9 w-9 justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary',
          className
        )}
      >
        {variant === 'nav' ? (
          <>
            {t('categories')}
            <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
          </>
        ) : (
          <LayoutGrid className="h-5 w-5" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={variant === 'nav' ? 'start' : 'end'}
        className="max-h-[70vh] w-64 overflow-y-auto"
      >
        <DropdownMenuItem asChild>
          <Link href="/marketplace" className="font-semibold">
            <LayoutGrid className="text-primary" />
            {t('allCategories')}
            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </Link>
        </DropdownMenuItem>

        {products.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('products')}
            </DropdownMenuLabel>
            {products.map((c) => (
              <DropdownMenuItem key={c.id} asChild>
                <Link href={`/marketplace?categoryId=${c.id}`}>{c.name}</Link>
              </DropdownMenuItem>
            ))}
          </>
        )}

        {services.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('servicesGroup')}
            </DropdownMenuLabel>
            {services.map((c) => (
              <DropdownMenuItem key={c.id} asChild>
                <Link href={`/marketplace?kind=SERVICE&categoryId=${c.id}`}>{c.name}</Link>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
