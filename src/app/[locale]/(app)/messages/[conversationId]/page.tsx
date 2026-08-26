import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ChevronLeft } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TrustBadge } from '@/components/trust/trust-badge';
import { ActiveIndicator } from '@/components/trust/active-indicator';
import { ChatThread, type ChatMessage } from '@/components/messaging/chat-thread';
import { ChatHiringActions } from '@/components/messaging/chat-hiring-actions';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { markConversationRead } from '@/lib/messaging';
import { publish } from '@/lib/realtime';
import { initials, isActiveToday } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ConversationPage({
  params,
}: {
  params: { locale: string; conversationId: string };
}) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('messages');
  const tt = await getTranslations('trust');

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.conversationId },
    include: {
      listing: { select: { id: true, title: true, status: true } },
      job: { select: { id: true, title: true, employerId: true } },
      participants: {
        include: {
          user: {
            select: { id: true, fullName: true, avatarUrl: true, isVerified: true, lastActiveAt: true },
          },
        },
      },
    },
  });

  if (!conversation) notFound();
  // Access gate via the shared authorizer (rule 5) — non-participants get a 404.
  const participantIds = conversation.participants.map((p) => p.userId);
  if (!(await can(user, 'conversation:access', { participantIds }))) notFound();

  const other = conversation.participants.find((p) => p.userId !== user.id)?.user ?? null;

  const rawMessages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  // Opening the thread marks it read and tells the other side (live receipts).
  await markConversationRead(conversation.id, user.id);
  if (other) {
    publish(other.id, {
      type: 'message_read',
      conversationId: conversation.id,
      readerId: user.id,
    });
  }

  const messages: ChatMessage[] = rawMessages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    readAt: m.readAt?.toISOString() ?? null,
  }));

  const active = isActiveToday(other?.lastActiveAt ?? null);
  const context = conversation.listing
    ? t('aboutListing', { title: conversation.listing.title })
    : conversation.job
      ? t('aboutJob', { title: conversation.job.title })
      : null;

  // Employer side of a job thread → structured hiring actions (§5). Only shown
  // when the viewer owns the job (shared authorizer) and the other participant
  // actually applied to it.
  const isJobEmployer = conversation.job
    ? await can(user, 'job:viewApplicants', conversation.job)
    : false;
  const hiring =
    isJobEmployer && conversation.job && other
      ? await prisma.application.findUnique({
          where: { jobId_applicantId: { jobId: conversation.job.id, applicantId: other.id } },
          select: { id: true, status: true },
        })
      : null;

  return (
    <div className="container max-w-2xl py-4">
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <Link
          href="/messages"
          className="text-muted-foreground hover:text-foreground"
          aria-label={t('title')}
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <Avatar>
          {other?.avatarUrl && <AvatarImage src={other.avatarUrl} alt={other.fullName} />}
          <AvatarFallback>{initials(other?.fullName ?? '?')}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{other?.fullName}</span>
            {other?.isVerified && <TrustBadge variant="chat" status="VERIFIED" verifiedLabel={tt('verifiedBadge')} />}
          </div>
          {context ? (
            <p className="truncate text-xs text-primary">{context}</p>
          ) : (
            <ActiveIndicator active={active} label={active ? t('online') : t('offline')} />
          )}
        </div>
      </div>

      {hiring && conversation.job && other && (
        <ChatHiringActions
          conversationId={conversation.id}
          applicationId={hiring.id}
          jobTitle={conversation.job.title}
          applicantName={other.fullName}
          initialStatus={hiring.status}
        />
      )}

      <ChatThread
        conversationId={conversation.id}
        currentUserId={user.id}
        initialMessages={messages}
        listingId={conversation.listing?.id}
        listingSold={
          conversation.listing?.status === 'SOLD' || conversation.listing?.status === 'PAUSED'
        }
      />
    </div>
  );
}
