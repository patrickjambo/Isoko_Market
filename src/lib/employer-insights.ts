import 'server-only';
import type { ApplicationStatus } from '@prisma/client';
import { prisma } from './prisma';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type EmployerSuggestion = {
  // views-but-no-applications | stale-open | needs-shortlist | verify-to-reach
  type: 'raise_pay_or_clarify' | 'stale_repost' | 'review_applicants' | 'verify_for_reach';
  jobId?: string;
  title?: string;
  count?: number;
};

export type JobFunnel = {
  id: string;
  title: string;
  status: string;
  type: string;
  viewCount: number;
  applied: number;
  shortlisted: number;
  hired: number;
  newCount: number; // unreviewed (still APPLIED)
};

export type EmployerInsights = {
  activeCount: number;
  applicantsToday: number;
  newApplicants: number; // unreviewed across all open jobs
  hiredThisMonth: number;
  viewsTotal: number;
  suggestion: EmployerSuggestion | null;
  funnels: JobFunnel[];
};

const IN_PLAY: ApplicationStatus[] = ['APPLIED', 'VIEWED', 'SHORTLISTED', 'INTERVIEW'];

/**
 * Employer rule engine (§2) — the mirror of {@link getSellerInsights}. Produces
 * the numbers for the home cards, a per-job hiring funnel, and the single most
 * useful "Suggested Action" (never a checklist dump). All from real data.
 */
export async function getEmployerInsights(
  employerId: string,
  isVerified: boolean
): Promise<EmployerInsights> {
  const now = Date.now();
  const dayAgo = new Date(now - DAY);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const jobs = await prisma.job.findMany({
    where: { employerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      type: true,
      viewCount: true,
      createdAt: true,
      applications: { select: { status: true, appliedAt: true } },
    },
  });

  let applicantsToday = 0;
  let newApplicants = 0;
  let hiredThisMonth = 0;
  let viewsTotal = 0;
  const funnels: JobFunnel[] = [];

  for (const j of jobs) {
    viewsTotal += j.viewCount;
    let applied = 0;
    let shortlisted = 0;
    let hired = 0;
    let newCount = 0;
    for (const a of j.applications) {
      applied++;
      if (a.status === 'SHORTLISTED' || a.status === 'INTERVIEW') shortlisted++;
      if (a.status === 'HIRED') {
        hired++;
        if (a.appliedAt >= monthStart) hiredThisMonth++;
      }
      if (a.status === 'APPLIED') newCount++;
      if (a.appliedAt >= dayAgo) applicantsToday++;
    }
    if (j.status === 'OPEN') newApplicants += newCount;
    funnels.push({
      id: j.id,
      title: j.title,
      status: j.status,
      type: j.type,
      viewCount: j.viewCount,
      applied,
      shortlisted,
      hired,
      newCount,
    });
  }

  const openJobs = jobs.filter((j) => j.status === 'OPEN');
  const activeCount = openJobs.length;

  // Rules in priority order — return the first strong match.
  let suggestion: EmployerSuggestion | null = null;

  // 1. Real interest but no applications → the posting needs tuning.
  for (const j of openJobs) {
    if (j.viewCount >= 10 && j.applications.length === 0) {
      suggestion = { type: 'raise_pay_or_clarify', jobId: j.id, title: j.title, count: j.viewCount };
      break;
    }
  }
  // 2. Applicants waiting on a decision → review them.
  if (!suggestion) {
    const totalNew = funnels
      .filter((f) => f.status === 'OPEN')
      .reduce((s, f) => s + f.newCount, 0);
    if (totalNew >= 3) suggestion = { type: 'review_applicants', count: totalNew };
  }
  // 3. Old open posting with no traction → repost/refresh.
  if (!suggestion) {
    for (const j of openJobs) {
      if (now - j.createdAt.getTime() > 14 * DAY && j.applications.length === 0) {
        suggestion = { type: 'stale_repost', jobId: j.id, title: j.title };
        break;
      }
    }
  }
  // 4. Unverified employer → verification unlocks reach, not posting (§3/§7).
  if (!suggestion && !isVerified && activeCount > 0) {
    suggestion = { type: 'verify_for_reach' };
  }

  return {
    activeCount,
    applicantsToday,
    newApplicants,
    hiredThisMonth,
    viewsTotal,
    suggestion,
    funnels,
  };
}
