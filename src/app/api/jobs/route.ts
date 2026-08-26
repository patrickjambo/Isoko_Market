import type { NextRequest } from 'next/server';
import { route, jsonOk } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createJobSchema, jobFilterSchema } from '@/lib/validators/job';
import { francsToMinor } from '@/lib/utils';
import { searchJobs } from '@/lib/queries';
import { canonicalSkill } from '@/lib/skills';
import { notifyMatchingSavedSearches } from '@/lib/saved-search';
import { emitAdmin } from '@/lib/admin-realtime';

/** GET /api/jobs — public filtered search. */
export const GET = route(async (req: NextRequest) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const filter = jobFilterSchema.parse(params);
  return jsonOk(await searchJobs(filter));
});

/** POST /api/jobs — post a job/gig (free core action; any logged-in user). */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const input = createJobSchema.parse(await req.json().catch(() => ({})));

  // Only attach a partner that actually exists and is active.
  let partnerId: string | null = null;
  if (input.partnerId) {
    const partner = await prisma.partner.findFirst({
      where: { id: input.partnerId, status: 'ACTIVE' },
      select: { id: true },
    });
    partnerId = partner?.id ?? null;
  }

  // Normalize required skills to canonical taxonomy keys (§10 shared vocabulary).
  const skills = Array.from(new Set(input.skills.map(canonicalSkill).filter(Boolean)));

  const job = await prisma.job.create({
    data: {
      employerId: user.id,
      title: input.title,
      description: input.description,
      type: input.type,
      payMin: input.payMin != null ? francsToMinor(input.payMin) : null,
      payMax: input.payMax != null ? francsToMinor(input.payMax) : null,
      payPeriod: input.payPeriod,
      location: input.location,
      skills,
      partnerId,
    },
    select: { id: true, title: true, description: true, type: true, location: true, skills: true },
  });

  // Promote a first-time poster to EMPLOYER (never downgrade an existing role).
  if (user.role === 'BUYER') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'EMPLOYER' } });
  }

  // Notify seekers whose saved searches match — evaluated live, not batched (§8).
  await notifyMatchingSavedSearches({ ...job, employerId: user.id });

  // Admin activity ticker parity with listing.created (rule 6 gap).
  await emitAdmin('job.created', `New ${job.type === 'GIG' ? 'gig' : 'job'}: ${job.title}`);

  return jsonOk({ id: job.id }, { status: 201 });
});
