'use client';

import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * Lightweight inline sign-up prompt for a gated guest action (Visitor spec §5).
 * Instead of a jarring redirect it explains WHY, and carries the current page as
 * `returnTo` so registration drops the user back exactly where they left off.
 */
export function SignUpPrompt({
  reason,
  triggerLabel,
  variant = 'accent',
  className,
}: {
  reason: string;
  triggerLabel: string;
  variant?: 'default' | 'accent' | 'outline';
  className?: string;
}) {
  const t = useTranslations('onboarding');
  const pathname = usePathname();
  const ret = `?returnTo=${encodeURIComponent(pathname)}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('gateTitle')}</DialogTitle>
          <DialogDescription>{reason}</DialogDescription>
        </DialogHeader>
        <Button asChild variant="accent" size="lg">
          <Link href={`/register${ret}`}>
            <UserPlus className="h-4 w-4" /> {t('signUp30s')}
          </Link>
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t('haveAccount')}{' '}
          <Link href={`/login${ret}`} className="font-semibold text-primary hover:underline">
            {t('logIn')}
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
