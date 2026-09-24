import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Locale negotiation + prefixing. Auth/RBAC is enforced per-route in Server
// Components and API handlers (Section 10) — never only in middleware.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, and any file with an extension (the brand
  // icon is a static /icon.png, caught by the dotted-file rule).
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
