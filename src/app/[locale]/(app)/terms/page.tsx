import { setRequestLocale } from 'next-intl/server';
import { Prose } from '@/components/shared/prose';
import { getFeatureFlags } from '@/lib/feature-flags';

export const metadata = { title: 'Terms of Service' };

export default async function TermsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const flags = await getFeatureFlags();
  const jobsAny = flags.jobsEnabled || flags.hiringEnabled || flags.cvBuilderEnabled;

  return (
    <Prose title="Terms of Service">
      <p>
        By using Zenova you agree to trade honestly, post accurate listings
        {jobsAny ? ' and jobs' : ''}, and treat other members with respect.
      </p>
      <h2>Free core actions</h2>
      <p>
        Creating an account{jobsAny ? ', posting listings, uploading a CV, and applying to jobs' : ' and posting listings'} are free.
        Premium, optional features (featured listings, verified seller subscriptions{jobsAny ? ', job boosts' : ''})
        are paid via mobile money.
      </p>
      <h2>Trust &amp; safety</h2>
      <p>
        Unverified accounts have reduced visibility and limited transactions. Fraud, scams, and
        prohibited items are not allowed and may lead to removal. Report anything suspicious using
        the report button.
      </p>
      <h2>Liability</h2>
      <p>
        Zenova connects buyers{jobsAny ? ', sellers, employers and job-seekers' : ' and sellers'} but is not a party to the
        transactions between them. Always meet safely and confirm goods before paying.
      </p>
    </Prose>
  );
}
