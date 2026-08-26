import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateApplicationSchema } from '@/lib/validators/job';
import { authorize } from '@/lib/authz';
import { publish } from '@/lib/realtime';
import { notify } from '@/lib/notifications';
import { cascadeJobFilled } from '@/lib/job-cascade';

/**
 * PATCH /api/applications/[id] — employer moves an application through its
 * lifecycle (viewed → shortlisted → hired/rejected). The applicant sees the
 * change live (Section 6.3 / 9.1).
 */
export const PATCH = route(async (req: NextRequest, ctx: { params: { id: string } }) => {
  const user = await requireUser();
  const { status } = updateApplicationSchema.parse(await req.json().catch(() => ({})));

  const application = await prisma.application.findUnique({
    where: { id: ctx.params.id },
    include: { job: { select: { employerId: true, title: true, id: true } } },
  });
  if (!application) throw new ApiError('NOT_FOUND', 'Application not found.');
  await authorize(user, 'application:decide', application, {
    message: 'Only the employer can update this application.',
  });

  await prisma.application.update({ where: { id: application.id }, data: { status } });

  // Real-time status update for the applicant, plus a persisted notification.
  publish(application.applicantId, {
    type: 'application_update',
    applicationId: application.id,
    status,
  });
  await notify({
    userId: application.applicantId,
    type: 'APPLICATION_UPDATE',
    title: `Update on "${application.job.title}"`,
    body: `Your application is now: ${status}`,
    href: '/profile/applications',
    payload: { jobId: application.job.id, applicationId: application.id },
  });

  // Hiring fills the position: close the job and move every other pending
  // applicant to POSITION_FILLED so nobody is left in limbo (§10 cascade).
  let filledOthers = 0;
  if (status === 'HIRED') {
    filledOthers = await cascadeJobFilled(application.job.id, application.applicantId);
  }

  return jsonOk({ ok: true, status, filledOthers });
});
