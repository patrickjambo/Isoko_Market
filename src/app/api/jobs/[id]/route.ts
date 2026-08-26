import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { authorize } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { publishTopic } from '@/lib/realtime';
import { cascadeJobFilled } from '@/lib/job-cascade';

const patchSchema = z.object({ status: z.enum(['OPEN', 'CLOSED']) });

/** PATCH /api/jobs/[id] — employer-only open/close. */
export const PATCH = route(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const { status } = patchSchema.parse(await req.json().catch(() => ({})));

  const job = await prisma.job.findUnique({
    where: { id: ctx.params.id },
    select: { employerId: true },
  });
  if (!job) throw new ApiError('NOT_FOUND', 'Job not found.');
  await authorize(user, 'job:close', job);

  if (status === 'CLOSED') {
    // Closing fills the position: cascade pending applicants to POSITION_FILLED
    // and close the job atomically, notifying each in real time (§10).
    const filledOthers = await cascadeJobFilled(ctx.params.id);
    return jsonOk({ ok: true, status, filledOthers });
  }

  await prisma.job.update({ where: { id: ctx.params.id }, data: { status } });

  // Only the reopen (status OPEN) path reaches here — closing routes through the
  // job-filled cascade and returns early above.
  publishTopic(`job:${ctx.params.id}`, {
    type: 'entity_update',
    entity: 'job',
    id: ctx.params.id,
    status,
    reason: 'reopened',
  });

  return jsonOk({ ok: true, status });
});
