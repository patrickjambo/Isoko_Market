import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing, type AppLocale } from '@/i18n/routing';
import { getCurrentUser, touchLastActive } from '@/lib/auth';
import { toSessionUser } from '@/lib/serialize';
import { env } from '@/lib/env';
import { Providers } from '@/components/providers';
import { ServiceWorkerRegister } from '@/components/shared/service-worker-register';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Zenova — Connecting Communities • Empowering Trade',
    template: '%s · Zenova',
  },
  description:
    'A trust-first, multilingual marketplace and job board for Rwandan youth. Buy, sell, and find work with verified people. Kinyarwanda, English & French.',
  applicationName: 'Zenova',
  // Use the validated env (empty/whitespace already normalized to the default)
  // so an unset/blank NEXT_PUBLIC_APP_URL can't crash the build via new URL('').
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  manifest: '/manifest.webmanifest',
  // Installable-app polish: home-screen icon + full-screen iOS launch. Both the
  // favicon and the Apple touch icon use the Zenova logo (a raster PNG — iOS
  // ignores SVG apple-touch-icons, so a raster is required for a clean install).
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Zenova',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b6b62',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // allow zoom (Section 8.4)
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as AppLocale)) {
    notFound();
  }
  setRequestLocale(locale);

  const messages = await getMessages();
  const user = await getCurrentUser();
  if (user) void touchLastActive(user.id);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans">
        <NextIntlClientProvider messages={messages}>
          <Providers user={user ? toSessionUser(user) : null}>{children}</Providers>
        </NextIntlClientProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
