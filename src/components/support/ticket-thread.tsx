import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils';

export type ThreadMessage = {
  id: string;
  body: string;
  fromStaff: boolean;
  senderName: string;
  createdAt: Date;
};

/**
 * The message list for a support ticket. Staff replies are tinted and labelled
 * so it always reads as a clear back-and-forth between the user and the team.
 */
export function TicketThread({
  messages,
  locale,
  staffLabel,
}: {
  messages: ThreadMessage[];
  locale: string;
  staffLabel: string;
}) {
  return (
    <ul className="space-y-3">
      {messages.map((m) => (
        <li
          key={m.id}
          className={cn(
            'max-w-[85%] rounded-2xl border px-4 py-3',
            m.fromStaff
              ? 'border-primary/20 bg-primary/5'
              : 'ml-auto border-border bg-card'
          )}
        >
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {m.fromStaff ? staffLabel : m.senderName}
            </span>
            <span>·</span>
            <span>{timeAgo(m.createdAt, locale)}</span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
        </li>
      ))}
    </ul>
  );
}
