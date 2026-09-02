import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/nav/header';
import { Footer } from '@/components/nav/footer';
import { BottomNav } from '@/components/nav/bottom-nav';
import { BackButton } from '@/components/nav/back-button';

/**
 * Authenticated/app chrome: persistent top nav (desktop) + bottom tab bar
 * (mobile), with a bottom-padding buffer so content clears the mobile tab bar
 * (Section 8.2).
 */
export default function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <BackButton />
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <Footer />
      <BottomNav />
    </div>
  );
}
