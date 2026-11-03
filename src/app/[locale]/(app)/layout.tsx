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
 * (Section 8.2).
 *
 * Feature flags are fetched here for nav rendering. Thanks to React's `cache()`
 * on `getPlatformSettings`, this is deduplicated with the root locale layout's
 * flag fetch and the home page's flag fetch — only ONE DB round-trip occurs per
 * request, regardless of how many components call `getFeatureFlags()`.
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
