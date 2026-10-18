import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUnreadMessageCount } from '@/lib/queries';
import { EmployerShell } from '@/components/employer/employer-shell';
import { getFeatureFlags } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

/** Employer dashboard chrome — auth-gated collapsible sidebar; an employer only
 *  ever sees their own jobs, applicants and messages (§10 ownership). */
export default async function EmployerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const flags = await getFeatureFlags();
  if (!flags.hiringEnabled) notFound();

  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const [unread, newApplicants] = await Promise.all([
    getUnreadMessageCount(user.id),
    prisma.application.count({
      where: { job: { employerId: user.id, status: 'OPEN' }, status: 'APPLIED' },
    }),
  ]);

  return (
    <EmployerShell unread={unread} newApplicants={newApplicants}>
      {children}
    </EmployerShell>
  );
}
