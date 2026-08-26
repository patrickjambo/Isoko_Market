import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Prose } from '@/components/shared/prose';

export const metadata = { title: 'How it works' };

export default async function HowItWorksPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('home');
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
          <p className="font-semibold text-foreground">{t('step3Title')}</p>
          <p>{t('step3Body')}</p>
        </li>
      </ol>
    </Prose>
  );
}
