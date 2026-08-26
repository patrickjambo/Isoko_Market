import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Logo } from '@/components/brand/logo';
import { ShieldCheck } from 'lucide-react';

export async function Footer() {
  const t = await getTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border bg-secondary/40">
      <div className="container flex flex-col gap-6 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm space-y-3">
          <Logo />
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            {t('dataNote')}
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm" aria-label="Footer">
          <Link href="/about" className="text-muted-foreground hover:text-foreground">
            {t('about')}
          </Link>
          <Link href="/how-it-works" className="text-muted-foreground hover:text-foreground">
            {t('howItWorks')}
          </Link>
          <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
            {t('privacy')}
          </Link>
          <Link href="/terms" className="text-muted-foreground hover:text-foreground">
            {t('terms')}
          </Link>
        </nav>
      </div>
      <div className="border-t border-border py-4">
        <p className="container text-center text-xs text-muted-foreground">
          {t('rights', { year })}
        </p>
      </div>
    </footer>
  );
}
