import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Users } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { ApplicantReview } from '@/components/employer/applicant-review';
import { requireWorkspace } from '@/lib/workspace-guard';
import { getEmployerApplicants } from '@/lib/employer-applicants';

export const dynamic = 'force-dynamic';

export default async function EmployerApplicantsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('employer');

  const user = await requireWorkspace('employer', params.locale);
  const applicants = await getEmployerApplicants(user.id, params.locale);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t('applicants')}</h1>
        <p className="text-sm text-muted-foreground">{t('applicantsSubtitle')}</p>
      </div>

      {applicants.length === 0 ? (
        <EmptyState icon={Users} title={t('noApplicants')} description={t('noApplicantsHint')} />
      ) : (
        <ApplicantReview applicants={applicants} locale={params.locale} showJob />
      )}
    </div>
  );
}
