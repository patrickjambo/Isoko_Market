import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MessageCircle } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { VerifiedBadge } from '@/components/trust/verified-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { PollRefresh } from '@/components/shared/poll-refresh';
import { getCurrentUser } from '@/lib/auth';
import { getConversationsForUser } from '@/lib/messaging';
import { initials, timeAgo, cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function MessagesPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: '/login', locale: params.locale });
    return null;
  }

  const t = await getTranslations('messages');
  const tt = await getTranslations('trust');
  const conversations = await getConversationsForUser(user.id);

  return (
    <div className="container max-w-2xl py-6">
      <PollRefresh />
      <h1 className="mb-4 text-2xl font-bold tracking-tight">{t('title')}</h1>

      {conversations.length === 0 ? (
        <EmptyState icon={MessageCircle} title={t('empty')} description={t('emptyHint')} />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 p-3 transition-colors hover:bg-secondary/50"
              >
                <Avatar>
                  {c.other?.avatarUrl && (
                    <AvatarImage src={c.other.avatarUrl} alt={c.other.fullName} />
                  )}
                  <AvatarFallback>{initials(c.other?.fullName ?? '?')}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{c.other?.fullName}</span>
                    {c.other?.isVerified && (
                      <VerifiedBadge status="VERIFIED" label={tt('verifiedBadge')} />
                    )}
                    {c.lastMessage && (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {timeAgo(c.lastMessage.createdAt, params.locale)}
                      </span>
                    )}
                  </div>
                  {(c.listing || c.job) && (
                    <p className="truncate text-xs text-primary">
                      {c.listing ? c.listing.title : c.job?.title}
                    </p>
                  )}
                  <p
                    className={cn(
                      'truncate text-sm',
                      c.unread ? 'font-semibold text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {c.lastMessage
                      ? `${c.lastMessage.fromMe ? `${t('you')}: ` : ''}${c.lastMessage.body}`
                      : t('emptyHint')}
                  </p>
                </div>
                {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
