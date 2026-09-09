import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Locale negotiation + prefixing. Auth/RBAC is enforced per-route in Server
// Components and API handlers (Section 10) — never only in middleware.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, generated metadata icons (served at a bare
  // path, e.g. /apple-icon — no dot, so it must be excluded explicitly or the
  // locale prefix would 307-redirect iOS away from its home-screen icon), and any
  // file with an extension.
  matcher: ['/((?!api|_next|_vercel|apple-icon|icon|.*\\..*).*)'],
};
