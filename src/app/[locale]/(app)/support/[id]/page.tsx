import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { SupportLive } from '@/components/support/support-live';
import { TicketThread } from '@/components/support/ticket-thread';
import { ReplyForm } from '@/components/support/reply-form';
import { TicketControls } from '@/components/support/ticket-controls';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<string, 'success' | 'muted' | 'secondary'> = {
  OPEN: 'secondary',
  PENDING: 'muted',
  RESOLVED: 'success',
  CLOSED: 'muted',
};

export default async function TicketPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }
  const t = await getTranslations('support');

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      subject: true,
      status: true,
      priority: true,
      category: true,
      userId: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          body: true,
          fromStaff: true,
          createdAt: true,
          sender: { select: { fullName: true } },
        },
      },
    },
  });
  // Owner-only view (staff use /admin/support/[id]).
  if (!ticket || ticket.userId !== user.id) notFound();

  const messages = ticket.messages.map((m) => ({
    id: m.id,
    body: m.body,
    fromStaff: m.fromStaff,
    senderName: m.sender.fullName,
    createdAt: m.createdAt,
  }));

  return (
    <div className="container max-w-2xl space-y-5 py-6">
      <SupportLive />

      <Link
        href="/support"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t('backToTickets')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{ticket.subject}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{t(`category_${ticket.category}`)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[ticket.status] ?? 'muted'}>{t(`status_${ticket.status}`)}</Badge>
          <TicketControls
            ticketId={ticket.id}
            status={ticket.status}
            priority={ticket.priority}
            canManage={false}
          />
        </div>
      </div>

      <TicketThread messages={messages} locale={params.locale} staffLabel={t('staffLabel')} />

      {ticket.status === 'CLOSED' ? (
        <p className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-center text-sm text-muted-foreground">
          {t('closedNote')}{' '}
          <Link href="/support/new" className="font-semibold text-primary hover:underline">
            {t('newTicket')}
          </Link>
        </p>
      ) : (
        <ReplyForm ticketId={ticket.id} />
      )}
    </div>
  );
}
