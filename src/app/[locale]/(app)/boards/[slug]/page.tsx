import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Briefcase, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { JobCard } from '@/components/jobs/job-card';
import { EmptyState } from '@/components/shared/empty-state';
import { LogoMark } from '@/components/brand/logo';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getBoard(slug: string) {
  return prisma.partner.findUnique({
    where: { slug },
    include: {
      jobs: {
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          type: true,
          payMin: true,
          payMax: true,
          payPeriod: true,
          location: true,
          employer: { select: { fullName: true, isVerified: true } },
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const partner = await prisma.partner.findUnique({ where: { slug: params.slug } });
  return { title: partner ? `${partner.name} — Jobs` : 'Board' };
}

/**
 * Partner / cooperative white-label job board (Phase 5). A branded, shareable
 * page listing a partner's open roles, powered by the Isoko backend.
 */
export default async function BoardPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  setRequestLocale(params.locale);
  const t = await getTranslations('boards');
  const board = await getBoard(params.slug);
  if (!board) notFound();

  const accent = board.brandColor ?? undefined;

  return (
    <div>
      {/* Branded header */}
      <header
        className="border-b border-border"
        style={accent ? { backgroundColor: `${accent}14` } : undefined}
      >
        <div className="container py-10">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: accent ?? 'hsl(176 84% 22%)' }}
            >
              <Briefcase className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight">{board.name}</h1>
                <Badge variant="secondary">{board.type}</Badge>
              </div>
              {board.tagline && <p className="text-muted-foreground">{board.tagline}</p>}
              {board.location && (
                <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {board.location}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <h2 className="mb-4 text-lg font-semibold">
          {t('openRoles')} ({board.jobs.length})
        </h2>

        {board.jobs.length === 0 ? (
          <EmptyState icon={Briefcase} title={t('noRoles')} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {board.jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}

        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <LogoMark className="h-5 w-5" />
          <span>{t('poweredBy')}</span>
          <Link href="/jobs" className="font-medium text-primary hover:underline">
            {t('backToJobs')}
          </Link>
        </div>
      </div>
    </div>
  );
}
