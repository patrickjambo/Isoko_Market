import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { authorize } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/jobs/[id]/repost — one-tap duplicate of a past posting as a fresh
 * OPEN job (§6). High-value for recurring gig needs (weekly market-day help).
 * Copies content only — applicants/conversations are NOT carried over.
 */
export const POST = route(async (_req, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const src = await prisma.job.findUnique({ where: { id: ctx.params.id } });
  if (!src) throw new ApiError('NOT_FOUND', 'Job not found.');
  await authorize(user, 'job:repost', src);

  const job = await prisma.job.create({
    data: {
      employerId: user.id,
      title: src.title,
      description: src.description,
      type: src.type,
      payMin: src.payMin,
      payMax: src.payMax,
      payPeriod: src.payPeriod,
      location: src.location,
      skills: src.skills,
      partnerId: src.partnerId,
      status: 'OPEN',
    },
    select: { id: true },
  });

  return jsonOk({ id: job.id }, { status: 201 });
});
