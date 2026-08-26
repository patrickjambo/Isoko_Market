'use client';

import { Plus, Store, Wrench, Briefcase } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The single "+ Post" entry point that unifies the commerce and employment
 * paths (Section 8.2) — sell an item, offer a service, or post a job.
 */
export function PostMenu({ full = false }: { full?: boolean }) {
  const t = useTranslations('nav');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="accent" size={full ? 'default' : 'sm'} className={full ? 'w-full' : ''}>
          <Plus className="h-4 w-4" />
          {t('post')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('post')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/sell">
            <Store className="text-primary" />
            {t('postItem')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/sell">
            <Wrench className="text-primary" />
            {t('postService')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/jobs/new">
            <Briefcase className="text-accent" />
            {t('postJob')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
