import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { authorize } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { cvDataSchema } from '@/lib/validators/cv';

/**
 * GET /api/applications/[id]/cv/snapshot — return the CV snapshot as JSON so
 * the employer's review modal can load it lazily (only when opened) instead of
 * baking the full JSON into every row of the applicant list page.
 *
 * Only the employer who owns the job may call this endpoint (same auth as
 * /api/applications/[id]/cv/pdf).
 */
export const GET = route(async (_req, ctx: { params: { id: string } }) => {
  const user = await requireUser();

  const application = await prisma.application.findUnique({
    where: { id: ctx.params.id },
    select: {
      applicantId: true,
      cvSnapshot: true,
      applicant: { select: { fullName: true } },
      job: { select: { employerId: true } },
    },
  });
  if (!application) throw new ApiError('NOT_FOUND', 'Application not found.');
  await authorize(user, 'application:viewCv', application, {
    message: 'Only the employer can view this CV.',
  });
  if (!application.cvSnapshot) throw new ApiError('NOT_FOUND', 'No CV was submitted.');

  const parsed = cvDataSchema.safeParse(application.cvSnapshot);
  const data = parsed.success ? parsed.data : {};

  return jsonOk({ snapshot: data, applicantName: application.applicant.fullName });
});
