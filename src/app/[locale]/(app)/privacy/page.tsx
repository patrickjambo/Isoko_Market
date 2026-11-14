import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Prose } from '@/components/shared/prose';
import { getFeatureFlags } from '@/lib/feature-flags';
import { env } from '@/lib/env';

const BASE = env.NEXT_PUBLIC_APP_URL;

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const title = 'Privacy Policy | Zenova Rwanda';
  const description =
    'How Zenova Rwanda collects, uses, and protects your personal data under Rwanda\'s Data Protection Law. Your rights, ID document handling, and contact details.';
  return {
    title,
    description,
    alternates: {
      canonical: `${BASE}/en/privacy`,
      languages: { en: `${BASE}/en/privacy`, rw: `${BASE}/rw/privacy`, fr: `${BASE}/fr/privacy` },
    },
    openGraph: {
      title,
      description,
      url: `${BASE}/${params.locale}/privacy`,
      siteName: 'Zenova Rwanda | Buy & Sell',
      images: [{ url: `${BASE}/og-default.png`, width: 1200, height: 630, alt: 'Zenova Rwanda Privacy Policy' }],
      type: 'website',
    },
    twitter: { card: 'summary', title, description },
  };
}

export default async function PrivacyPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const flags = await getFeatureFlags();
  const jobsAny = flags.jobsEnabled || flags.hiringEnabled || flags.cvBuilderEnabled;

  return (
    <Prose title="Privacy Policy">
      <p>
        Zenova is committed to protecting your personal data in line with Rwanda&apos;s
        Law No. 058/2021 on the Protection of Personal Data and Privacy.
      </p>
      <h2>What we collect</h2>
      <p>
        Your phone number (used as your login), your name and profile details,
        listings{jobsAny ? ' and jobs' : ''} you post, messages you send, and — only if you choose to get
        verified — a copy of your National ID.
      </p>
      <h2>How we use it</h2>
      <p>
        To operate the marketplace{jobsAny ? ' and job board' : ''}, verify identities to keep the platform
        trustworthy, deliver notifications, and process mobile-money payments for optional premium
        features.
      </p>
      <h2>ID documents</h2>
      <p>
        Your National ID is encrypted, never shown publicly, accessed only by our trust team for
        verification, and served through short-lived signed links. You can request its deletion at
        any time.
      </p>
      <h2>Your rights</h2>
      <p>
        You may access, correct, or delete your personal data, and withdraw consent for ID storage.
        Contact us to exercise these rights. We retain data only as long as needed to provide the
        service or as required by law.
      </p>
    </Prose>
  );
}
