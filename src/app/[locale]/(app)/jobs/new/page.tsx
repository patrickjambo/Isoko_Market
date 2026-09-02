import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CreateJobForm } from '@/components/jobs/create-job-form';

export default async function NewJobPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('jobs');
  const partners = await prisma.partner.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="container max-w-2xl py-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('createTitle')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t('createSubtitle')}</p>
      <CreateJobForm partners={partners} />
    </div>
  );
}
