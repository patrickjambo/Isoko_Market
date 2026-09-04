import 'server-only';
import type { JobType } from '@prisma/client';
import { prisma } from './prisma';
import { notify } from './notifications';
import { canonicalSkill } from './skills';

type NewJob = {
  id: string;
  title: string;
  description: string;
  type: JobType;
  location: string;
  skills: string[];
  employerId: string;
};

/**
 * Evaluate a freshly-created job against every stored saved search AS IT IS
 * CREATED — not on a batch schedule (§8) — so urgent gigs reach seekers while
 * still relevant. Each matching seeker gets a real-time + persisted (and, if
 * offline, SMS) notification. The employer never notifies themselves.
 */
export async function notifyMatchingSavedSearches(job: NewJob): Promise<number> {
  const searches = await prisma.savedSearch.findMany({
    where: { kind: 'JOB', userId: { not: job.employerId } },
    select: { id: true, userId: true, label: true, q: true, type: true, location: true, skills: true },
  });
  if (searches.length === 0) return 0;

  const title = job.title.toLowerCase();
  const description = job.description.toLowerCase();
  const location = job.location.toLowerCase();
  const jobSkills = new Set(job.skills.map(canonicalSkill));

  // A seeker can have several saved searches — notify each user at most once.
  const notified = new Set<string>();
  let count = 0;

  for (const s of searches) {
    if (notified.has(s.userId)) continue;
    if (s.type && s.type !== job.type) continue;
    if (s.location && !location.includes(s.location.toLowerCase().split(',')[0]!.trim())) continue;
    if (s.q) {
      const term = s.q.toLowerCase();
      if (!title.includes(term) && !description.includes(term)) continue;
    }
    if (s.skills.length > 0) {
      const wanted = s.skills.map(canonicalSkill);
      if (!wanted.some((k) => jobSkills.has(k))) continue;
    }
    // A search with no criteria at all is ignored (would match everything).
    if (!s.q && !s.type && !s.location && s.skills.length === 0) continue;

    notified.add(s.userId);
    count++;
    await notify({
      userId: s.userId,
      type: 'SYSTEM',
      title: s.label || job.title,
      body: `New ${job.type === 'GIG' ? 'gig' : 'job'}: ${job.title}`,
      href: `/jobs/${job.id}`,
      payload: { jobId: job.id, savedSearchId: s.id },
    });
  }
  return count;
}
