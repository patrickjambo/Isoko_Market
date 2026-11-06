import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Prose } from '@/components/shared/prose';
import { getFeatureFlags } from '@/lib/feature-flags';

export const metadata = { title: 'How it works' };

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
