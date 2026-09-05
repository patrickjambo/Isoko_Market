import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Briefcase, Plus } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { JobCard } from '@/components/jobs/job-card';
import { JobFilters } from '@/components/jobs/job-filters';
import { JobFilterDialog } from '@/components/jobs/job-filter-dialog';
import { SaveSearchButton } from '@/components/jobs/save-search-button';
import { SeekerHome } from '@/components/jobs/seeker-home';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import { jobFilterSchema } from '@/lib/validators/job';
import { searchJobs, getCvSkills } from '@/lib/queries';
import { getCurrentUser } from '@/lib/auth';
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

  return (
    <div className="container py-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild variant="accent">
          <Link href="/jobs/new">
            <Plus className="h-4 w-4" /> {t('createTitle')}
          </Link>
        </Button>
      </div>

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
