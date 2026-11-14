import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Prose } from '@/components/shared/prose';
import { getFeatureFlags } from '@/lib/feature-flags';
import { env } from '@/lib/env';

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const BASE = env.NEXT_PUBLIC_APP_URL;
  const LOCALES = ['en', 'rw', 'fr'] as const;

  const title = 'About Zenova — Rwanda\'s Online Marketplace, Services & Jobs Platform';
  const description =
    'Discover Zenova (zenova.rw), Rwanda\'s trusted digital platform connecting buyers, sellers, service providers, and job seekers across Kigali and all 30 districts.';

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE}/en/about`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${BASE}/${l}/about`])),
    },
    openGraph: {
      title,
      description,
      url: `${BASE}/${params.locale}/about`,
      siteName: 'Zenova Rwanda | Buy & Sell',
      images: [{ url: `${BASE}/og-default.png`, width: 1200, height: 630, alt: 'About Zenova Rwanda' }],
      type: 'website',
      locale: params.locale,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${BASE}/og-default.png`],
    },
  };
}

export default async function AboutPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const flags = await getFeatureFlags();
  const jobsAny = flags.jobsEnabled || flags.hiringEnabled || flags.cvBuilderEnabled;

  const faqs = [
    {
      question: 'What is Zenova (zenova.rw)?',
      answer:
        'Zenova is a Rwandan technology platform and trusted online marketplace connecting buyers, sellers, service providers, and job seekers across Rwanda. It empowers local trade with verified user profiles, Mobile Money payments, and full support for Kinyarwanda, English, and French.',
    },
    {
      question: 'What services does Zenova provide in Rwanda?',
      answer:
        'Zenova offers a multi-category marketplace to buy and sell products (electronics, phones, vehicles, fashion, home goods), rental and professional services, and an integrated job portal with a built-in CV builder for Rwandan professionals and youth.',
    },
    {
      question: 'Where is Zenova available in Rwanda?',
      answer:
        'Zenova is available across all 30 districts of Rwanda, including Kigali (Gasabo, Kicukiro, Nyarugenge), Musanze, Rubavu, Huye, Rwamagana, Muhanga, and beyond.',
    },
    {
      question: 'How does Zenova keep transactions safe?',
      answer:
        'Zenova ensures community safety through National ID verification badges for sellers, public rating and review systems, peer-to-peer Mobile Money (MTN MoMo and Airtel Money) integration, and strict listing moderation.',
    },
  ];

  return (
    <>
      {/* ── Structured Data: AboutPage + Organization + FAQPage for Google & AI Engines ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'AboutPage',
              name: 'About Zenova Rwanda',
              description:
                'Official information about Zenova, Rwanda\'s trusted online marketplace and employment platform.',
              url: `${env.NEXT_PUBLIC_APP_URL}/${params.locale}/about`,
              mainEntity: {
                '@type': 'Organization',
                name: 'Zenova',
                alternateName: ['Zenova Rwanda', 'Isoko Zenova'],
                url: env.NEXT_PUBLIC_APP_URL,
                logo: `${env.NEXT_PUBLIC_APP_URL}/icon-512.png`,
                description:
                  'Zenova is a Rwandan technology platform and digital marketplace connecting buyers, sellers, service providers, and job seekers across Rwanda.',
                areaServed: {
                  '@type': 'Country',
                  name: 'Rwanda',
                },
                knowsAbout: [
                  'E-commerce in Rwanda',
                  'Online Marketplace Kigali',
                  'Jobs in Rwanda',
                  'Buy and Sell in Kigali',
                  'Rwandan Youth Employment',
                ],
              },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqs.map((faq) => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: faq.answer,
                },
              })),
            },
          ]),
        }}
      />

      <Prose title="About Zenova">
        <p className="text-base text-foreground font-medium">
          <strong>Zenova (zenova.rw)</strong> is a Rwandan digital platform created to empower local trade,
          reduce digital exclusion, and connect people across Rwanda through a trusted, fast, and accessible marketplace
          {jobsAny ? ', services directory, and employment platform' : ''}.
        </p>

        <h2>What Zenova does</h2>
        <p>
          Zenova brings the essential pillars of local commerce and career opportunities together in one trusted platform:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-foreground">
          <li>
            <strong>Verified Marketplace:</strong> Buy and sell new and pre-owned electronics, smartphones, vehicles, fashion,
            furniture, agricultural products, and property with verified sellers.
          </li>
          <li>
            <strong>Services &amp; Rentals:</strong> Discover skilled technicians, creative professionals, artisans, and rental housing
            across Kigali and all districts of Rwanda.
          </li>
          {jobsAny && (
            <li>
              <strong>Jobs &amp; Career Opportunities:</strong> Browse verified full-time jobs, gigs, and freelance projects,
              paired with an interactive CV builder designed for Rwandan youth and professionals.
            </li>
          )}
          <li>
            <strong>Mobile Money Integration:</strong> Fast and familiar payment workflows using MTN MoMo and Airtel Money.
          </li>
          <li>
            <strong>Trilingual Accessibility:</strong> Fully localized in Kinyarwanda, English, and French, optimized for low data usage
            and accessible on any mobile device or smartphone.
          </li>
        </ul>

        <h2>Our commitment to trust &amp; safety</h2>
        <p>
          Trust is the foundation of Zenova. We verify seller identities using national identification inspection,
          provide transparent ratings and reviews from genuine transactions, and maintain community safety safeguards so you always know
          who you are dealing with.
        </p>

        <h2>Serving all of Rwanda</h2>
        <p>
          Whether you are based in the heart of Kigali (Nyarugenge, Gasabo, Kicukiro) or in secondary cities and districts
          such as Musanze, Rubavu, Huye, Rwamagana, or Rusizi, Zenova is built to bring buyers and sellers together.
        </p>

        <h2>Frequently asked questions</h2>
        <div className="space-y-4 pt-2">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground text-sm">{faq.question}</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </Prose>
    </>
  );
}
