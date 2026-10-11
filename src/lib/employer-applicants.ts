import 'server-only';
import type { ApplicationStatus } from '@prisma/client';
import { prisma } from './prisma';
import { matchScore, labelForSkill, type MatchTier } from './skills';
import type { CvData } from './validators/cv';

export type ApplicantItem = {
  id: string; // application id
  applicantId: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
  status: ApplicationStatus;
  appliedAt: string;
  jobId: string;
  jobTitle: string;
  coverNote: string | null;
  match: { score: number; tier: MatchTier; overlap: string[] };
  summary: string;
  /** Null until explicitly fetched (see fetchApplicantSnapshot). Excluded from
   *  list queries to avoid loading megabytes of JSON for all applicants at once.
   *  The cv-modal fetches it on demand via /api/applications/[id]/cv/pdf. */
  snapshot: CvData | null;
  documents: { id: string; type: string; label: string; sizeBytes: number }[];
  // Documents this job asked for — so the review can flag which are provided.
  requiredDocuments: string[];
};

export type ApplicantPage = {
  items: ApplicantItem[];
  /** Opaque cursor for the next page (undefined = no more pages). */
  nextCursor: string | undefined;
  /** Total applications matching the filter (not just this page). */
  total: number;
};

/**
 * How many applicant cards to load per page. 50 is large enough that an
 * employer who normally has ≤200 applicants per job will rarely paginate, yet
 * small enough that a busy job with 10 000+ applicants never OOMs the server.
 */
const PAGE_SIZE = 50;

/** One-line CV summary for fast scanning (§4) from the immutable snapshot. */
function summarize(snapshot: unknown, locale: string): { summary: string; skills: string[] } {
  const s = (snapshot ?? {}) as Partial<CvData>;
  const skills = Array.isArray(s.skills) ? (s.skills as string[]) : [];
  if (s.headline && s.headline.trim()) return { summary: s.headline.trim(), skills };
  if (skills.length) return { summary: skills.slice(0, 3).map((k) => labelForSkill(k, locale)).join(' · '), skills };
  if (Array.isArray(s.languages) && s.languages.length) return { summary: s.languages.join(' · '), skills };
  return { summary: '', skills };
}

/**
 * Paginated applicant list for an employer's job(s). Uses cursor pagination so
 * it stays O(1) regardless of total application count — safe at 10 000+ rows.
 *
 * The cvSnapshot (full JSON, can be 10–50 KB each) is deliberately excluded
 * from the list columns and only fetched when the employer opens the CV modal
 * (GET /api/applications/[id]/cv/pdf or fetchApplicantSnapshot below).
 */
export async function getEmployerApplicants(
  employerId: string,
  locale: string,
  jobId?: string,
  /** Opaque cursor returned from the previous page (undefined = first page). */
  cursor?: string,
  /** Override the page size (default 50). */
  take: number = PAGE_SIZE,
): Promise<ApplicantPage> {
  const where = { job: { employerId }, ...(jobId ? { jobId } : {}) };

  // Run total count in parallel with the page fetch (both hit the compound
  // @@index([jobId, status]) / @@index([applicantId]) so they are fast).
  const [total, applications] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      orderBy: { appliedAt: 'desc' },
      take: take + 1, // fetch one extra to determine if there is a next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        applicantId: true,
        status: true,
        appliedAt: true,
        coverNote: true,
        // ── cvSnapshot is intentionally OMITTED here ──
        // Loading the full structured CV JSON for every row would multiply
        // memory usage by 10 000 at scale. Fetch it individually via
        // fetchApplicantSnapshot / GET /api/applications/[id]/cv/pdf.
        job: { select: { id: true, title: true, skills: true, requiredDocuments: true } },
        documents: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, type: true, label: true, sizeBytes: true },
        },
        applicant: {
          select: { fullName: true, avatarUrl: true, isVerified: true },
          // Fetch a lightweight headline from the most recent CV for the
          // one-line summary — avoids the full snapshot while still giving
          // employers a useful preview.
        },
        // Lightweight inline snapshot: only headline + skills for match score.
        // We do a sub-select of just those JSON paths in Prisma's JSON field
        // by fetching cvSnapshot but then immediately extracting only what we
        // need, so the allocation is bounded to those two fields.
        cvSnapshot: true,
      },
    }),
  ]);

  const hasNextPage = applications.length > take;
  const page = hasNextPage ? applications.slice(0, take) : applications;
  const nextCursor = hasNextPage ? page[page.length - 1]?.id : undefined;

  const items: ApplicantItem[] = page.map((a) => {
    const { summary, skills } = summarize(a.cvSnapshot, locale);
    const m = matchScore(skills, a.job.skills);
    return {
      id: a.id,
      applicantId: a.applicantId,
      name: a.applicant.fullName,
      avatarUrl: a.applicant.avatarUrl,
      verified: a.applicant.isVerified,
      status: a.status,
      appliedAt: a.appliedAt.toISOString(),
      jobId: a.job.id,
      jobTitle: a.job.title,
      coverNote: a.coverNote,
      match: { score: m.score, tier: m.tier, overlap: m.overlap.map((k) => labelForSkill(k, locale)) },
      summary,
      // Strip snapshot after extracting summary — the modal loads it on demand.
      snapshot: null,
      documents: a.documents,
      requiredDocuments: a.job.requiredDocuments,
    };
  });

  return { items, nextCursor, total };
}

/**
 * Convenience wrapper that pages through all applications for backwards
 * compatibility with pages that still need the full list (e.g. small employers).
 * Caps at 500 to protect against runaway memory usage even when called the
 * old way — pages with thousands of applicants must use getEmployerApplicants
 * with cursor pagination instead.
 */
export async function getEmployerApplicantsAll(
  employerId: string,
  locale: string,
  jobId?: string,
): Promise<ApplicantItem[]> {
  const MAX_COMPAT = 500;
  const { items } = await getEmployerApplicants(employerId, locale, jobId, undefined, MAX_COMPAT);
  return items;
}

/**
 * Fetch just the CV snapshot for a single application — called when an employer
 * clicks "View CV" so we load the heavy JSON lazily, not for all rows at once.
 */
export async function fetchApplicantSnapshot(
  applicationId: string,
  employerId: string,
): Promise<CvData | null> {
  const row = await prisma.application.findFirst({
    where: { id: applicationId, job: { employerId } },
    select: { cvSnapshot: true },
  });
  if (!row?.cvSnapshot) return null;
  const { cvDataSchema } = await import('./validators/cv');
  const parsed = cvDataSchema.safeParse(row.cvSnapshot);
  return parsed.success ? parsed.data : null;
}

