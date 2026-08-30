import { getTranslations, getLocale } from 'next-intl/server';
import { route, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/authz';
import { cvDataSchema } from '@/lib/validators/cv';
import { generateCvPdf, cvPdfLabels } from '@/lib/cv-pdf';
import { formatPhoneDisplay } from '@/lib/phone';

/**
 * GET /api/applications/[id]/cv/pdf — the hiring employer downloads the CV the
 * applicant submitted, rendered from the IMMUTABLE snapshot frozen at apply time
 * (§10) so it never drifts from what was reviewed. Same generator/labels as the
 * seeker's own download, so the two PDFs are identical.
 */
export const GET = route(async (_req, ctx: { params: { id: string } }) => {
  const user = await requireUser();

  const application = await prisma.application.findUnique({
    where: { id: ctx.params.id },
    select: {
      applicantId: true,
      cvSnapshot: true,
      applicant: { select: { fullName: true, phone: true, location: true } },
      job: { select: { employerId: true } },
    },
  });
  if (!application) throw new ApiError('NOT_FOUND', 'Application not found.');
  await authorize(user, 'application:viewCv', application, {
    message: 'Only the employer can view this CV.',
  });
  if (!application.cvSnapshot) throw new ApiError('NOT_FOUND', 'No CV was submitted.');

  const data = cvDataSchema.parse(application.cvSnapshot);
  const t = await getTranslations('cv');
  const locale = await getLocale();

  const pdf = await generateCvPdf({
    fullName: application.applicant.fullName,
    phone: application.applicant.phone ? formatPhoneDisplay(application.applicant.phone) : undefined,
    // Prefer the CV's structured location path over the coarse profile field.
    location: data.location?.label ?? application.applicant.location ?? undefined,
    locale,
    data,
    labels: cvPdfLabels(t),
  });

  const filename = `${application.applicant.fullName.replace(/\s+/g, '_')}_CV.pdf`;
  return new Response(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
