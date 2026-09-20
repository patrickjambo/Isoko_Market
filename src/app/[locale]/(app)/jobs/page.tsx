import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Briefcase, Plus } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { JobCard } from '@/components/jobs/job-card';
import { JobFilters } from '@/components/jobs/job-filters';
import { JobFilterDialog } from '@/components/jobs/job-filter-dialog';
import { SaveSearchButton } from '@/components/jobs/save-search-button';
import { SeekerHome } from '@/components/jobs/seeker-home';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import { StoreResults } from '@/components/marketplace/store-results';
import { jobFilterSchema } from '@/lib/validators/job';
import { searchJobs, getCvSkills } from '@/lib/queries';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { storeName } from '@/lib/store';
import { matchScore } from '@/lib/skills';

export const dynamic = 'force-dynamic';

export default async function JobsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: Record<string, string | undefined>;
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('jobs');

  const filter = jobFilterSchema.parse(searchParams);
  const [{ items, total, page, pageSize }, user] = await Promise.all([
    searchJobs(filter),
    getCurrentUser(),
  ]);

  // Signed-in seekers get real match badges on every card (§4/§5).
  const cvSkills = user ? await getCvSkills(user.id) : [];

  // Searching a company name surfaces those employers (with open roles) as chips.
  const companyRows =
    filter.q && filter.q.trim().length >= 2
      ? await prisma.user.findMany({
          where: {
            jobs: { some: { status: 'OPEN' } },
            OR: [
              { businessName: { contains: filter.q, mode: 'insensitive' } },
              { fullName: { contains: filter.q, mode: 'insensitive' } },
            ],
          },
          take: 4,
          select: { id: true, fullName: true, businessName: true, avatarUrl: true, isVerified: true },
        })
      : [];
  const companies = companyRows.map((c) => ({
    id: c.id,
    name: storeName(c),
    avatarUrl: c.avatarUrl,
    isVerified: c.isVerified,
  }));

  return (
    <div className="container py-6">
      <PageHeader
        icon={Briefcase}
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button asChild variant="accent">
            <Link href="/jobs/new">
              <Plus className="h-4 w-4" /> {t('createTitle')}
            </Link>
          </Button>
        }
      />

      {/* Personalized job-seeker home for signed-in users (§2). */}
      {user && <SeekerHome userId={user.id} location={user.location} />}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <JobFilters current={searchParams} />
        </div>
        <JobFilterDialog current={searchParams} />
        <SaveSearchButton
          current={{ q: searchParams.q, type: searchParams.type, location: searchParams.location }}
        />
      </div>

      {/* Matching companies (when searching an employer/company name). */}
      <StoreResults stores={companies} label={t('companiesHiring')} icon={Briefcase} />

      {items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={t('empty')}
          description={t('emptyHint')}
          action={
            <Button asChild variant="accent">
              <Link href="/jobs/new">
                <Plus className="h-4 w-4" /> {t('createTitle')}
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                match={cvSkills.length ? matchScore(cvSkills, job.skills ?? []).tier : undefined}
              />
            ))}
          </div>
          <Pagination page={page} total={total} pageSize={pageSize} baseParams={searchParams} />
        </>
      )}
    </div>
  );
}
