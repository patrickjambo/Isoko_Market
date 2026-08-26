import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { applyJobSchema } from '@/lib/validators/job';
import { notify } from '@/lib/notifications';

/**
 * POST /api/jobs/[id]/apply — one-click apply using the applicant's stored CV
 * (Section 6.3). Enforces the unique (job, applicant) constraint so nobody can
 * apply twice.
 */
export const POST = route(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const { coverNote } = applyJobSchema.parse(await req.json().catch(() => ({})));

  const job = await prisma.job.findUnique({
    where: { id: ctx.params.id },
    select: { id: true, employerId: true, status: true, title: true },
  });
  if (!job) throw new ApiError('NOT_FOUND', 'Job not found.');
  if (job.status === 'CLOSED') throw new ApiError('CONFLICT', 'This job is closed.');
  if (job.employerId === user.id) {
    throw new ApiError('BAD_REQUEST', 'You cannot apply to your own job.');
  }

  const cv = await prisma.cV.findUnique({
    where: { userId: user.id },
    select: { id: true, structuredData: true },
  });
  if (!cv) {
    throw new ApiError('BAD_REQUEST', 'Create your CV before applying.');
  }

  const existing = await prisma.application.findUnique({
    where: { jobId_applicantId: { jobId: job.id, applicantId: user.id } },
    select: { id: true },
  });
  if (existing) throw new ApiError('CONFLICT', 'You already applied to this job.');

  const application = await prisma.application.create({
    data: {
      jobId: job.id,
      applicantId: user.id,
      cvId: cv.id,
      // Freeze the CV as it is now — editing it later never changes what this
      // employer reviewed (§10 immutable snapshot).
      cvSnapshot: cv.structuredData ?? undefined,
      coverNote,
    },
    select: { id: true },
  });

  await notify({
    userId: job.employerId,
    type: 'APPLICATION_UPDATE',
    title: 'New application',
    body: `${user.fullName} applied to "${job.title}"`,
    href: `/jobs/${job.id}/applicants`,
    payload: { jobId: job.id, applicationId: application.id },
  });

  return jsonOk({ id: application.id }, { status: 201 });
});
