import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShieldCheck } from 'lucide-react';
import { Prose } from '@/components/shared/prose';

export const metadata = { title: 'Is this safe?' };

/**
 * "Is this safe?" trust page (Visitor spec §7) — plain-language answers to the
 * fraud/payment-safety objection named as the platform's core problem. Fully
 * translated (rw/en/fr), reachable pre- and post-signup, and linked from every
 * verification prompt. Also explains how verification works and protects IDs.
 */
export default async function SafetyPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('safety');
  const items = [1, 2, 3, 4, 5];

  return (
    <Prose title={t('title')}>
      <p className="flex items-center gap-2 text-primary">
        <ShieldCheck className="h-5 w-5" /> {t('intro')}
      </p>
      <dl className="space-y-5">
        {items.map((n) => (
          <div key={n}>
            <dt className="font-semibold text-foreground">{t(`q${n}`)}</dt>
            <dd className="mt-1">{t(`a${n}`)}</dd>
          </div>
        ))}
      </dl>
    </Prose>
  );
}
