import { setRequestLocale } from 'next-intl/server';
import { Header } from '@/components/nav/header';
import { Footer } from '@/components/nav/footer';
import { BottomNav } from '@/components/nav/bottom-nav';
import { BackButton } from '@/components/nav/back-button';
import { InstallBanner } from '@/components/shared/install-banner';
import { getFeatureFlags } from '@/lib/feature-flags';
import { getCurrentUser } from '@/lib/auth';
import { VerificationNudge } from '@/components/onboarding/verification-nudge';

/**
 * Authenticated/app chrome: persistent top nav (desktop) + bottom tab bar
 * (mobile), with a bottom-padding buffer so content clears the mobile tab bar
 * (Section 8.2).
 *
 * Feature flags are fetched here for nav rendering. Thanks to React's `cache()`
 * on `getPlatformSettings`, this is deduplicated with the root locale layout's
 * flag fetch and the home page's flag fetch — only ONE DB round-trip occurs per
 * request, regardless of how many components call `getFeatureFlags()`.
 *
 * User is also fetched here (deduplicated via React cache) so the
 * VerificationNudge can display site-wide without extra DB round-trips.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const [flags, user] = await Promise.all([getFeatureFlags(), getCurrentUser()]);

  return (
    <div className="flex min-h-dvh flex-col max-w-full overflow-x-clip">
      <Header />
      <InstallBanner />
      {user && user.verificationStatus !== 'VERIFIED' && (
        <VerificationNudge verificationStatus={user.verificationStatus} />
      )}
      <BackButton />
      <main className="flex-1 pb-24 md:pb-0 min-w-0 max-w-full">{children}</main>
      <Footer />
      <BottomNav jobsEnabled={flags.jobsEnabled} />
    </div>
  );
}
