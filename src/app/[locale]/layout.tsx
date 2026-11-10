import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing, type AppLocale } from '@/i18n/routing';
import { getCurrentUser, touchLastActive } from '@/lib/auth';
import { toSessionUser } from '@/lib/serialize';
import { env } from '@/lib/env';
import { Providers } from '@/components/providers';
import { getFeatureFlags } from '@/lib/feature-flags';
import { getPlatformSettings } from '@/lib/commission';
import { ServiceWorkerRegister } from '@/components/shared/service-worker-register';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Zenova — Connecting Communities • Empowering Trade',
    template: '%s · Zenova',
  },
  description:
    'Rwanda\'s trusted online marketplace. Buy, sell, rent, find services and jobs. Verified sellers, secure payments, available in Kinyarwanda, English & French.',
  applicationName: 'Zenova',
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  manifest: '/manifest.webmanifest',
  keywords: [
    'online marketplace Rwanda',
    'buy and sell Rwanda',
    'buy electronics Kigali',
    'second hand products Rwanda',
    'rental houses Kigali',
    'find services Rwanda',
    'jobs in Rwanda',
    'Kigali marketplace',
    'Zenova Rwanda',
  ],
  openGraph: {
    type: 'website',
    siteName: 'Zenova Rwanda',
    title: 'Zenova — Buy, Sell, Rent & Find Work in Rwanda',
    description:
      'Rwanda\'s trusted online marketplace. Buy, sell, rent, find services and jobs with verified people across Kigali and Rwanda.',
    url: env.NEXT_PUBLIC_APP_URL,
    images: [
      {
        url: `${env.NEXT_PUBLIC_APP_URL}/icon-512.png`,
        width: 512,
        height: 512,
        alt: 'Zenova Rwanda marketplace',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Zenova — Buy, Sell, Rent & Find Work in Rwanda',
    description: 'Rwanda\'s trusted online marketplace for buying, selling, renting, and finding jobs.',
    images: [`${env.NEXT_PUBLIC_APP_URL}/icon-512.png`],
  },
  icons: {
    icon: [
      { url: '/favicon.ico?v=2', sizes: 'any' },
      { url: '/icon-192.png?v=2', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png?v=2', sizes: '512x512', type: 'image/png' },
      { url: '/icon.png?v=2', sizes: '1024x1024', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png?v=2', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico?v=2',
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

  const [messages, user, flags, settings] = await Promise.all([
    getMessages(),
    getCurrentUser(),
    getFeatureFlags(),
    getPlatformSettings(),
  ]);
  // Fire-and-forget: update the user's lastActiveAt timestamp. Guard is already
  // on `user` (void is a no-op if null), but the explicit `if` avoids scheduling
  // the micro-task entirely on unauthenticated requests — a marginal win on every
  // page load by anonymous visitors.
  if (user) void touchLastActive(user.id);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans">
        {/* ── Global structured data: Organization + WebSite ── */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'Zenova',
                alternateName: 'Zenova Rwanda',
                url: env.NEXT_PUBLIC_APP_URL,
                logo: `${env.NEXT_PUBLIC_APP_URL}/icon-512.png`,
                description:
                  "Rwanda's trusted online marketplace for buying, selling, renting, finding services and jobs.",
                areaServed: { '@type': 'Country', name: 'Rwanda' },
                sameAs: [],
              },
              {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'Zenova Rwanda',
                url: env.NEXT_PUBLIC_APP_URL,
                description:
                  "Rwanda's trusted online marketplace. Buy, sell, rent, find services and jobs.",
                potentialAction: {
                  '@type': 'SearchAction',
                  target: {
                    '@type': 'EntryPoint',
                    urlTemplate: `${env.NEXT_PUBLIC_APP_URL}/en/marketplace?q={search_term_string}`,
                  },
                  'query-input': 'required name=search_term_string',
                },
              },
            ]),
          }}
        />
        <NextIntlClientProvider messages={messages}>
          <Providers user={user ? toSessionUser(user) : null} initialFlags={flags} initialSubscriptionSettings={{
              subscriptionEnabled: settings.subscriptionEnabled,
              subscriptionMonthlyPrice: settings.subscriptionMonthlyPrice,
              subscriptionAnnualPrice: settings.subscriptionAnnualPrice,
              subscriptionMomoNumber: settings.subscriptionMomoNumber,
              subscriptionMomoKind: settings.subscriptionMomoKind,
              subscriptionRequireOnPublish: settings.subscriptionRequireOnPublish,
              subscriptionAutoExpireMonths: settings.subscriptionAutoExpireMonths,
              subscriptionAutoExpireListings: settings.subscriptionAutoExpireListings,
            }}>
            {children}
          </Providers>
        </NextIntlClientProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
