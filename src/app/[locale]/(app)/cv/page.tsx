import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { FileText } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { cvDataSchema, type CvData } from '@/lib/validators/cv';
import { CvChoice } from '@/components/cv/cv-choice';
import { PageHeader } from '@/components/shared/page-header';

export const dynamic = 'force-dynamic';

export default async function CvPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('cv');
  const [cv, docCount] = await Promise.all([
    prisma.cV.findUnique({ where: { userId: user.id } }),
    prisma.seekerDocument.count({ where: { userId: user.id } }),
  ]);
  const parsed = cv ? cvDataSchema.safeParse(cv.structuredData) : null;
  const initial: CvData | null = parsed?.success ? parsed.data : null;
  // Open on whichever path the seeker has already used; default to the builder.
  const initialMode = !initial && docCount > 0 ? 'upload' : 'build';

  return (
    <div className="container max-w-5xl py-6">
      <PageHeader icon={FileText} title={t('cvAndDocsTitle')} subtitle={t('cvAndDocsSubtitle')} />
      <CvChoice
        initial={initial}
        fullName={user.fullName}
        initialMode={initialMode}
        hasCv={Boolean(initial)}
        docCount={docCount}
      />
    </div>
  );
}
