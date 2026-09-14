import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LogIn } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

/**
 * Magic-link confirm page. Rendering this (a GET) consumes NOTHING — so a mail
 * scanner that prefetches the emailed link can't burn the login token. Pressing
 * the button POSTs to /api/auth/magic, which is what actually logs the user in.
 */
export default async function MagicLinkPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { email?: string; token?: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('auth');
  const email = searchParams.email ?? '';
  const token = searchParams.token ?? '';

  if (!email || !token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-bold tracking-tight">{t('magicInvalidTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('magicInvalidBody')}</p>
        <Button asChild>
          <Link href="/login">{t('backToLogin')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
        <LogIn className="h-6 w-6" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">{t('magicTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('magicSubtitle', { email })}</p>
      </div>
      {/* Native form POST — works without JS; the button press is what consumes
          the token (a prefetch GET of this page does not). */}
      <form method="POST" action="/api/auth/magic">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="locale" value={params.locale} />
        <Button type="submit" size="lg" className="w-full">
          <LogIn className="h-5 w-5" /> {t('magicButton')}
        </Button>
      </form>
    </div>
  );
}
