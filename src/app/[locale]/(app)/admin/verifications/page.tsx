import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/shared/empty-state';
import { VerificationActions } from '@/components/admin/verification-actions';
import { prisma } from '@/lib/prisma';
import { initials, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function VerificationsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');

  const pending = await prisma.verificationRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, fullName: true, avatarUrl: true, phone: true, location: true } },
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('pendingVerifications')}</h1>
        <p className="text-sm text-muted-foreground">{t('verificationsSubtitle')}</p>
      </header>

      {pending.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t('queueEmpty')} />
      ) : (
        <ul className="space-y-2">
          {pending.map((v) => (
            <li
              key={v.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center"
            >
              <Link href={`/profile/${v.user.id}`} className="flex flex-1 items-center gap-3">
                <Avatar>
                  {v.user.avatarUrl && <AvatarImage src={v.user.avatarUrl} alt={v.user.fullName} />}
                  <AvatarFallback>{initials(v.user.fullName)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{v.user.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {[v.user.location, timeAgo(v.createdAt, params.locale)].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Link>
              <VerificationActions requestId={v.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
