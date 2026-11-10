import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
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

  const title = 'How Zenova Works — Buy, Sell, and Find Work in Rwanda';
  const description =
    'Step-by-step guide to buying, selling, offering services, and finding jobs on Zenova Rwanda. Safe, simple peer-to-peer commerce and verified opportunities.';

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE}/en/how-it-works`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `${BASE}/${l}/how-it-works`])),
    },
    openGraph: {
      title,
      description,
      url: `${BASE}/${params.locale}/how-it-works`,
      siteName: 'Zenova Rwanda',
      images: [{ url: `${BASE}/icon-512.png`, width: 512, height: 512, alt: 'How Zenova Works' }],
      type: 'website',
      locale: params.locale,
    },
  };
}

export default async function HowItWorksPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const [t, flags] = await Promise.all([getTranslations('home'), getFeatureFlags()]);
  const jobsAny = flags.jobsEnabled || flags.hiringEnabled || flags.cvBuilderEnabled;

  return (
    <Prose title={t('howItWorksTitle')}>
      <ol className="list-decimal space-y-4 pl-5 text-foreground marker:font-bold marker:text-primary">
        <li>
          <p className="font-semibold text-foreground">{t('step1Title')}</p>
          <p>{t('step1Body')}</p>
        </li>
        <li>
          <p className="font-semibold text-foreground">{t('step2Title')}</p>
          <p>{t('step2Body')}</p>
        </li>
        <li>
          <p className="font-semibold text-foreground">
            {jobsAny ? t('step3Title') : t('step3TitleNoJobs')}
          </p>
          <p>{jobsAny ? t('step3Body') : t('step3BodyNoJobs')}</p>
        </li>
      </ol>
    </Prose>
  );
}
