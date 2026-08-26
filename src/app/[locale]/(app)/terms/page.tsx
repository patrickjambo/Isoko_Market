import { setRequestLocale } from 'next-intl/server';
import { Prose } from '@/components/shared/prose';

export const metadata = { title: 'Terms of Service' };

export default function TermsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  return (
    <Prose title="Terms of Service">
      <p>
        By using Isoko Market you agree to trade honestly, post accurate listings and jobs, and
        treat other members with respect.
      </p>
      <h2>Free core actions</h2>
      <p>
        Creating an account, posting listings, uploading a CV, and applying to jobs are free.
        Premium, optional features (featured listings, verified seller subscriptions, job boosts)
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
        Isoko Market connects buyers, sellers, employers and job-seekers but is not a party to the
        transactions between them. Always meet safely and confirm goods before paying.
      </p>
    </Prose>
  );
}
