/**
 * Branded loading screen shown during:
 *   1. App cold-start (PWA launch) while SSR renders the first page.
 *   2. Client-side navigations to pages that don't have their own loading state.
 *
 * Design goals:
 *   - Logo is prominent and immediately visible — the user knows which app opened.
 *   - A smooth, subtle progress indicator reassures users the app is working.
 *   - No fake percentage — we use an indeterminate animation, never lying about progress.
 *   - Lightweight: pure CSS animations (no JS timer), zero network requests.
 *   - Battery-friendly: uses CSS `will-change: transform` only where needed, and
 *     respects `prefers-reduced-motion` via the global CSS rule in globals.css.
 *   - Consistent with the brand: deep-teal gradient, system font, Zenova logo.
 *
 * This component is intentionally a Server Component (no 'use client' directive)
 * so it can be rendered immediately by Next during SSR without any JS hydration
 * cost — the loading animation is pure CSS.
 */
export function AppLoadingScreen() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-4"
      role="status"
      aria-label="Loading Zenova…"
    >
      {/* Logo mark — rendered as an inline img pointing at the pre-cached PNG so
          it displays instantly from the service worker cache without a JS module
          import. We keep the native <img> here (not next/image) because this
          component may render before the Next.js image optimisation layer is ready
          during cold-start, and we never want the logo to be the bottleneck. */}
      <div className="flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-192.png"
          alt="Zenova"
          width={72}
          height={72}
          className="h-[72px] w-[72px] rounded-2xl object-contain"
          style={{ imageRendering: 'auto' }}
        />
        <span className="text-2xl font-extrabold tracking-tight text-foreground">
          Zenova
        </span>
      </div>

      {/* Indeterminate loading bar — narrow, brand-teal, smooth.
          Uses a CSS-only approach: a 100%-width track with a translating fill.
          Stays off-screen until the animation starts so there's no flash. */}
      <div className="w-48 overflow-hidden rounded-full bg-muted" style={{ height: 3 }}>
        <div
          className="h-full rounded-full brand-gradient"
          style={{
            width: '40%',
            animation: 'loading-bar 1.6s ease-in-out infinite',
          }}
        />
      </div>

      {/* Screen-reader-only live text so assistive tech announces progress */}
      <span className="sr-only" aria-live="polite">
        Preparing your experience…
      </span>
    </div>
  );
}

/**
 * Full-page splash variant used at the top level (root loading.tsx).
 * Centres the loading screen in the full viewport so it fills the screen
 * during a PWA cold-start before any chrome (header/nav) is rendered.
 */
export function AppSplashScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background">
      <AppLoadingScreen />
    </div>
  );
}

