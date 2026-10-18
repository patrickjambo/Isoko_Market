import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/nav/header';
import { Footer } from '@/components/nav/footer';
import { BottomNav } from '@/components/nav/bottom-nav';
import { BackButton } from '@/components/nav/back-button';
import { InstallBanner } from '@/components/shared/install-banner';
import { getFeatureFlags } from '@/lib/feature-flags';

/**
 * Authenticated/app chrome: persistent top nav (desktop) + bottom tab bar
 * (mobile), with a bottom-padding buffer so content clears the mobile tab bar
 * (Section 8.2). Feature flags are fetched once here and distributed to nav
 * components so disabled features are hidden everywhere consistently.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const flags = await getFeatureFlags();

  return (
    <div className="flex min-h-dvh flex-col max-w-full overflow-x-clip">
      <Header />
      <InstallBanner />
      <BackButton />
      <main className="flex-1 pb-24 md:pb-0 min-w-0 max-w-full">{children}</main>
      <Footer />
      <BottomNav jobsEnabled={flags.jobsEnabled} />
    </div>
  );
}
