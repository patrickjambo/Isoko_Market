import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { emitAdmin } from '@/lib/admin-realtime';

const schema = z.object({ status: z.enum(['OPEN', 'CLOSED']) });

/**
 * PATCH /api/admin/jobs/[id] — close or reopen a job posting (moderation).
 * Closing takes it off the public board without deleting the record or its
 * applications. SuperAdmin/Moderator via `jobs.close`; audited + broadcast.
 */
export const PATCH = adminRoute(
  'jobs.close',
  async (req, ctx: { params: { id: string } }, { admin }) => {
    const { status } = schema.parse(await req.json().catch(() => ({})));

    const job = await prisma.job.findUnique({
      where: { id: ctx.params.id },
      select: { id: true, status: true, title: true },
    });
    if (!job) throw new ApiError('NOT_FOUND', 'Job not found.');

    await prisma.job.update({ where: { id: job.id }, data: { status } });

    const log = await audit({
      actorId: admin.id,
      action: status === 'CLOSED' ? 'jobs.close' : 'jobs.reopen',
      targetType: 'JOB',
      targetId: job.id,
      before: { status: job.status },
      after: { status },
    });

    await emitAdmin(
      'job.updated',
      `Job ${status === 'CLOSED' ? 'closed' : 'reopened'}: ${job.title}`
    );

    return { data: { status }, meta: { audit: log } };
  }
);
