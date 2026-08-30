import { getTranslations, getLocale } from 'next-intl/server';
import { route, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cvDataSchema } from '@/lib/validators/cv';
import { generateCvPdf, cvPdfLabels } from '@/lib/cv-pdf';
import { formatPhoneDisplay } from '@/lib/phone';

/** GET /api/cv/pdf — stream the current user's CV as a downloadable PDF. */
export const GET = route(async () => {
  const user = await requireUser();
  const cv = await prisma.cV.findUnique({ where: { userId: user.id } });
  if (!cv) throw new ApiError('NOT_FOUND', 'Build your CV first.');

  const data = cvDataSchema.parse(cv.structuredData);
  const t = await getTranslations('cv');
  const locale = await getLocale();

  const pdf = await generateCvPdf({
    fullName: user.fullName,
    phone: user.phone ? formatPhoneDisplay(user.phone) : undefined,
    // Prefer the CV's structured location path over the coarse profile field.
    location: data.location?.label ?? user.location ?? undefined,
    locale,
    data,
    labels: cvPdfLabels(t),
  });

  const filename = `${user.fullName.replace(/\s+/g, '_')}_CV.pdf`;
  return new Response(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
