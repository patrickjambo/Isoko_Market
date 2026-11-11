import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShieldCheck, AlertTriangle, FileText, Check } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { VerificationActions } from '@/components/admin/verification-actions';
import { IdPhoto } from '@/components/admin/id-photo';
import { AdminLiveRefresh } from '@/components/admin/admin-live-refresh';
import { prisma } from '@/lib/prisma';
import { initials, timeAgo } from '@/lib/utils';
import type { VerificationReviewItem } from '@/components/admin/verification-review-modal';

export const dynamic = 'force-dynamic';

export default async function VerificationsPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations('admin');

  const pending = await prisma.verificationRequest.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          avatarUrl: true,
          phone: true,
          location: true,
          createdAt: true,
        },
      },
    },
  });

  return (
    <div className="space-y-5">
      {/* New submissions + other admins' decisions appear live, no refresh. */}
      <AdminLiveRefresh />
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t('pendingVerifications')}</h1>
        <p className="text-sm text-muted-foreground">{t('verificationsSubtitle')}</p>
      </header>

      {pending.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={t('queueEmpty')} />
      ) : (
        <ul className="space-y-3">
          {pending.map((v) => {
            const formattedItem: VerificationReviewItem = {
              id: v.id,
              userId: v.userId,
              idDocumentUrl: v.idDocumentUrl,
              status: v.status as 'PENDING' | 'VERIFIED' | 'REJECTED',
              extractedFullName: v.extractedFullName,
              extractedIdNumber: v.extractedIdNumber,
              extractedCountry: v.extractedCountry,
              ocrConfidence: v.ocrConfidence,
              ocrRawText: v.ocrRawText,
              needsManualReview: v.needsManualReview,
              createdAt: v.createdAt.toISOString(),
              user: {
                id: v.user.id,
                fullName: v.user.fullName,
                email: v.user.email,
                phone: v.user.phone,
                location: v.user.location,
                createdAt: v.user.createdAt.toISOString(),
              },
            };

            return (
              <li
                key={v.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:p-4 sm:flex-row sm:items-center justify-between shadow-sm hover:border-slate-300 transition-colors"
              >
                {/* The actual National ID thumbnail with zoom modal */}
                <div className="flex items-center gap-3 min-w-0">
                  <IdPhoto requestId={v.id} />
                  <Link href={`/profile/${v.user.id}`} className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                      {v.user.avatarUrl && <AvatarImage src={v.user.avatarUrl} alt={v.user.fullName} />}
                      <AvatarFallback>{initials(v.user.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{v.user.fullName}</p>
                        {v.extractedCountry && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {v.extractedCountry}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[v.user.location, timeAgo(v.createdAt, params.locale)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </Link>
                </div>

                {/* OCR & Identification Badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {v.extractedIdNumber ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200">
                      <FileText className="h-3.5 w-3.5 text-slate-500" />
                      <span className="font-mono text-slate-700 font-semibold text-[11px]">
                        {v.extractedIdNumber}
                      </span>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-[11px] text-muted-foreground">
                      ID Number Unextracted
                    </Badge>
                  )}

                  {v.needsManualReview ? (
                    <Badge variant="destructive" className="text-[11px] gap-1">
                      <AlertTriangle className="h-3 w-3" /> Manual Review
                    </Badge>
                  ) : (
                    <Badge variant="success" className="text-[11px] gap-1">
                      <Check className="h-3 w-3" /> OCR Extracted
                    </Badge>
                  )}
                </div>

                {/* Review & Decision Actions */}
                <VerificationActions requestId={v.id} request={formattedItem} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
