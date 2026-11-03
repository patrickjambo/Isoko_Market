import { AppSplashScreen } from '@/components/shared/app-loading-screen';

/**
 * Root locale-level loading state — shown while the locale layout itself is
 * being streamed (e.g. during a PWA cold-start when the SSR response is still
 * being computed). Renders a full-viewport branded splash so the user sees
 * the Zenova logo and a loading indicator immediately instead of a blank white
 * screen or a frozen logo with no feedback.
 *
 * Next.js replaces this with the actual layout content as soon as it streams in.
 * Because this component has no 'use client' it is rendered instantly by the
 * server (or served from the service-worker shell cache) with zero JS cost.
 */
export default function LocaleLoading() {
  return <AppSplashScreen />;
}

