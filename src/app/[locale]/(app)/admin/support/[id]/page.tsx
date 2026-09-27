import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { AdminLiveRefresh } from '@/components/admin/admin-live-refresh';
import { TicketThread } from '@/components/support/ticket-thread';
import { ReplyForm } from '@/components/support/reply-form';
import { TicketControls } from '@/components/support/ticket-controls';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { effectivePermissions } from '@/lib/permissions';
import { timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<string, 'success' | 'muted' | 'secondary'> = {
  OPEN: 'secondary',
  PENDING: 'muted',
  RESOLVED: 'success',
  CLOSED: 'muted',
};

export default async function AdminTicketPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  setRequestLocale(params.locale);
  const admin = await getCurrentUser();
  if (!admin) notFound();
  const perms = await effectivePermissions(admin);
  if (!perms.has('support.view')) notFound();
  const canReply = perms.has('support.reply');
  const canManage = perms.has('support.manage');

  const t = await getTranslations('support');

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      subject: true,
      status: true,
      priority: true,
      category: true,
      createdAt: true,
      user: { select: { fullName: true, email: true, location: true } },
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
  if (!ticket) notFound();

  const messages = ticket.messages.map((m) => ({
    id: m.id,
    body: m.body,
    fromStaff: m.fromStaff,
    senderName: m.sender.fullName,
    createdAt: m.createdAt,
  }));

  return (
    <div className="space-y-5">
      <AdminLiveRefresh />

      <Link
        href="/admin/support"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t('backToQueue')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">{ticket.subject}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {[
              ticket.user.fullName,
              ticket.user.email,
              t(`category_${ticket.category}`),
              timeAgo(ticket.createdAt, params.locale),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[ticket.status] ?? 'muted'}>{t(`status_${ticket.status}`)}</Badge>
      </div>

      {canManage && (
        <TicketControls
          ticketId={ticket.id}
          status={ticket.status}
          priority={ticket.priority}
          canManage
        />
      )}

      <TicketThread messages={messages} locale={params.locale} staffLabel={t('staffLabel')} />

      {ticket.status === 'CLOSED' ? (
        <p className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-center text-sm text-muted-foreground">
          {t('closedNoteAdmin')}
        </p>
      ) : canReply ? (
        <ReplyForm ticketId={ticket.id} />
      ) : null}
    </div>
  );
}
