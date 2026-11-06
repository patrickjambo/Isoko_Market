import { setRequestLocale } from 'next-intl/server';
import { Prose } from '@/components/shared/prose';
import { getFeatureFlags } from '@/lib/feature-flags';

export const metadata = { title: 'About' };

export default async function AboutPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const flags = await getFeatureFlags();
  const jobsAny = flags.jobsEnabled || flags.hiringEnabled || flags.cvBuilderEnabled;

  return (
    <Prose title="About Zenova">
      <p>
        Zenova exists to reduce digital exclusion and empower local trade in Rwanda through a
        trusted, accessible and affordable platform to buy and sell{jobsAny ? ', and find work' : ''}.
      </p>
      <p>
        {jobsAny
          ? 'We bring commerce and employment together in one place: a verified marketplace, a job board with a built-in CV builder, mobile-money payments, and a fully multilingual experience in Kinyarwanda, English and French — designed to work well even on slow connections and older phones.'
          : 'We provide a trusted marketplace: verified sellers, seamless mobile-money payments, and a fully multilingual experience in Kinyarwanda, English and French — designed to work well even on slow connections and older phones.'}
      </p>
      <h2>Our commitment to trust</h2>
      <p>
        Every profile shows a verification status, so you always know who you are dealing with.
        Verification keeps the community safe while keeping the barrier to entry low.
      </p>
    </Prose>
  );
}
