'use client';

import { ChevronDown, LayoutGrid, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Header "Categories" dropdown — the marketplace browse categories, moved out of
 * the homepage strip so they're reachable from every page. Each item links to
 * the same `/marketplace?categoryId=…` filter as before, so browsing works
 * exactly as it did.
 */
export function CategoriesMenu({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const t = useTranslations('nav');
  if (categories.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground data-[state=open]:bg-secondary data-[state=open]:text-foreground">
        {t('categories')}
        <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[70vh] w-64 overflow-y-auto">
        <DropdownMenuItem asChild>
          <Link href="/marketplace" className="font-semibold">
            <LayoutGrid className="text-primary" />
            {t('allCategories')}
            <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {categories.map((c) => (
          <DropdownMenuItem key={c.id} asChild>
            <Link href={`/marketplace?categoryId=${c.id}`}>{c.name}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
