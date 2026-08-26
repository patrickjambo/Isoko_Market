import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cvDataSchema, type CvData } from '@/lib/validators/cv';
import { CvBuilder } from '@/components/cv/cv-builder';

export const dynamic = 'force-dynamic';

export default async function CvPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('cv');
  const cv = await prisma.cV.findUnique({ where: { userId: user.id } });
  const parsed = cv ? cvDataSchema.safeParse(cv.structuredData) : null;
  const initial: CvData | null = parsed?.success ? parsed.data : null;

  return (
    <div className="container max-w-5xl py-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t('subtitle')}</p>
      <CvBuilder initial={initial} fullName={user.fullName} />
    </div>
  );
}
