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
  snapshot: CvData | null;
};

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
 * Applicants for the employer's jobs (§4) with the SAME match calculation shown
 * to the seeker — computed here from the immutable CV snapshot (§10), so the
 * employer sees exactly what was submitted at apply time. Optionally scoped to
 * one job; otherwise across all of the employer's postings.
 */
export async function getEmployerApplicants(
  employerId: string,
  locale: string,
  jobId?: string
): Promise<ApplicantItem[]> {
  const applications = await prisma.application.findMany({
    where: { job: { employerId }, ...(jobId ? { jobId } : {}) },
    orderBy: { appliedAt: 'desc' },
    select: {
      id: true,
      applicantId: true,
      status: true,
      appliedAt: true,
      coverNote: true,
      cvSnapshot: true,
      job: { select: { id: true, title: true, skills: true } },
      applicant: { select: { fullName: true, avatarUrl: true, isVerified: true } },
    },
  });

  return applications.map((a) => {
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
      snapshot: (a.cvSnapshot ?? null) as CvData | null,
    };
  });
}
