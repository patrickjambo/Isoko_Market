import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing, type AppLocale } from '@/i18n/routing';
import { getCurrentUser, touchLastActive } from '@/lib/auth';
import { toSessionUser } from '@/lib/serialize';
import { Providers } from '@/components/providers';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Isoko Market — Connecting Communities • Empowering Trade',
    template: '%s · Isoko Market',
  },
  description:
    'A trust-first, multilingual marketplace and job board for Rwandan youth. Buy, sell, and find work with verified people. Kinyarwanda, English & French.',
  applicationName: 'Isoko Market',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
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
      </body>
    </html>
  );
}
