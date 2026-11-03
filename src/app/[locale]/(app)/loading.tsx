import { AppLoadingScreen } from '@/components/shared/app-loading-screen';

/**
 * Generic instant-navigation skeleton for app pages that don't ship their own
 * loading state. Keeps the persistent chrome (header/nav) and shows a branded
 * loading indicator so navigation feels instant even on dynamic routes —
 * Next prefetches this state on hover/viewport, so it appears immediately.
 *
 * This is also shown at cold-start (PWA launch) when the SSR response is
 * being computed — users see a polished branded screen instead of a blank page.
 */
export default function AppLoading() {
  return <AppLoadingScreen />;
}
