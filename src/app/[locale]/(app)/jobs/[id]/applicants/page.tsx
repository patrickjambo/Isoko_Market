import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Users } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { EmptyState } from '@/components/shared/empty-state';
import { ApplicantReview } from '@/components/employer/applicant-review';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { getEmployerApplicants } from '@/lib/employer-applicants';

export const dynamic = 'force-dynamic';

export default async function ApplicantsPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('jobs');
  const te = await getTranslations('employer');

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const job = await prisma.job.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, employerId: true },
  });
  if (!job) notFound();
  if (!(await can(user, 'job:viewApplicants', job))) notFound(); // employer-only (§10, rule 5)

  const applicants = await getEmployerApplicants(user.id, params.locale, job.id);

  return (
    <div className="container max-w-3xl py-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">{t('manageApplicants')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t('applicants', { count: applicants.length })}
      </p>

      {applicants.length === 0 ? (
        <EmptyState icon={Users} title={te('noApplicants')} description={te('noApplicantsHint')} />
      ) : (
        <ApplicantReview applicants={applicants} locale={params.locale} />
      )}
    </div>
  );
}
