import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { asContact } from '@/lib/contact';
import { CreateJobForm } from '@/components/jobs/create-job-form';

export const dynamic = 'force-dynamic';

export default async function EditJobPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('jobs');
  const [job, partners] = await Promise.all([
    prisma.job.findUnique({ where: { id: params.id } }),
    prisma.partner.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  if (!job) notFound();
  if (job.employerId !== user.id) notFound(); // owner-only (same as the API authorizer)

  return (
    <div className="container max-w-2xl py-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('editTitle')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t('editSubtitle')}</p>
      <CreateJobForm
        partners={partners}
        jobId={job.id}
        initial={{
          title: job.title,
          type: job.type,
          location: job.location,
          latitude: job.latitude,
          longitude: job.longitude,
          payMin: job.payMin != null ? String(Math.round(job.payMin / 100)) : '',
          payMax: job.payMax != null ? String(Math.round(job.payMax / 100)) : '',
          payPeriod: job.payPeriod ?? 'month',
          contact: asContact(job.contactInfo) ?? {},
          description: job.description,
          requirements: job.requirements ?? '',
          requiredDocuments: job.requiredDocuments,
          skills: job.skills,
          partnerId: job.partnerId ?? '',
        }}
      />
    </div>
  );
}
