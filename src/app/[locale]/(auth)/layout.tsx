import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Logo } from '@/components/brand/logo';
import { LocaleSwitcher } from '@/components/nav/locale-switcher';

/** Minimal, focused chrome for onboarding — no bottom nav, one clear task. */
export default function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="container flex h-16 items-center justify-between">
        <Link href="/" aria-label="Isoko Market home">
          <Logo />
        </Link>
        <LocaleSwitcher />
      </header>
      <main className="container flex flex-1 items-center justify-center py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
