'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Check, CheckCheck, Loader2, HandCoins } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useRealtime } from '@/hooks/use-realtime';
import { cn, formatRWF } from '@/lib/utils';

export type ChatMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

/**
 * Real-time conversation view (Section 6.5 / 9.1). New messages appear via SSE
 * within ~1s without a refresh; read receipts update live.
 */
export function ChatThread({
  conversationId,
  currentUserId,
  initialMessages,
  listingId,
  listingSold: listingSoldInitial = false,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
  listingId?: string;
  listingSold?: boolean;
}) {
  const t = useTranslations('messages');
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [sold, setSold] = useState(listingSoldInitial);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offer, setOffer] = useState('');

  // Live "item no longer available" banner (Section 5) — watch the listing topic.
  useEffect(() => {
    if (!listingId || typeof window === 'undefined') return;
    const src = new EventSource(`/api/realtime/topic?name=listing:${listingId}`);
    src.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as { type: string; entity?: string; status?: string };
        if (ev.type === 'entity_update' && ev.entity === 'listing') {
          setSold(ev.status === 'SOLD' || ev.status === 'PAUSED');
        }
      } catch {
        /* ignore */
      }
    };
    return () => src.close();
  }, [listingId]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingSentAt = useRef(0);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  };

  useEffect(scrollToBottom, [messages.length, otherTyping]);

  // WhatsApp-style live sync without a refresh. SSE (below) gives instant updates
  // when it reaches this client, but the in-memory bus can't cross Vercel's
  // function instances — so poll the thread every ~3s while visible: new messages
  // from the other side appear, and the GET also marks the thread read (which
  // flips our sent messages to "seen" ✓✓ once the other side polls). Merges by id
  // so it coexists with SSE and never re-renders when nothing changed.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const res = await fetch(`/api/messages?conversationId=${encodeURIComponent(conversationId)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: ChatMessage[] };
        if (!active || !Array.isArray(data.messages)) return;
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          let changed = false;
          for (const m of data.messages!) {
            const existing = byId.get(m.id);
            if (!existing || existing.readAt !== m.readAt) {
              byId.set(m.id, m);
              changed = true;
            }
          }
          if (!changed) return prev;
          return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
      } catch {
        /* ignore transient errors — the next tick retries */
      }
    };

    const schedule = () => {
      timer = setTimeout(async () => {
        await poll();
        if (active) schedule();
      }, 3000);
    };
    schedule();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [conversationId]);

  useRealtime((event) => {
    if (event.type === 'message' && event.conversationId === conversationId) {
      setOtherTyping(false);
      setMessages((prev) => {
        if (prev.some((m) => m.id === event.message.id)) return prev;
        return [...prev, { ...event.message, readAt: null }];
      });
    }
    if (event.type === 'message_read' && event.conversationId === conversationId) {
      // The other side read our messages — mark mine as read.
      if (event.readerId !== currentUserId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === currentUserId && !m.readAt
              ? { ...m, readAt: new Date().toISOString() }
              : m
          )
        );
      }
    }
    if (
      event.type === 'typing' &&
      event.conversationId === conversationId &&
      event.userId !== currentUserId
    ) {
      setOtherTyping(true);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => setOtherTyping(false), 3000);
    }
  });

  // Notify the other side we're typing, at most every ~2s.
  function signalTyping() {
    const now = Date.now();
    if (now - typingSentAt.current < 2000) return;
    typingSentAt.current = now;
    void fetch('/api/messages/typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    });
  }

  async function sendText(text: string): Promise<boolean> {
    if (!text.trim() || sending) return false;
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, body: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message.id) ? prev : [...prev, { ...data.message, readAt: null }]
        );
        return true;
      }
    } catch {
      /* fall through */
    } finally {
      setSending(false);
    }
    return false;
  }

  async function send() {
    const text = body.trim();
    if (!text) return;
    setBody('');
    if (!(await sendText(text))) setBody(text);
  }

  async function sendOffer() {
    const amount = Number(offer);
    if (!amount || amount < 1) return;
    // Structured offer (Section 5) rendered as a clear message both sides read.
    const ok = await sendText(`🤝 ${t('offerLabel')}: ${formatRWF(amount * 100, locale)}`);
    if (ok) {
      setOffer('');
      setOfferOpen(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col md:h-[calc(100dvh-9rem)]">
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.map((m) => {
          const mine = m.senderId === currentUserId;
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm',
                  mine
                    ? 'rounded-br-sm bg-primary text-primary-foreground'
                    : 'rounded-bl-sm bg-secondary text-secondary-foreground'
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div
                  className={cn(
                    'mt-0.5 flex items-center justify-end gap-1 text-[10px]',
                    mine ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}
                >
                  <time>
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                  {mine &&
                    (m.readAt ? (
                      <CheckCheck className="h-3 w-3" aria-label={t('read')} />
                    ) : (
                      <Check className="h-3 w-3" aria-label={t('delivered')} />
                    ))}
                </div>
              </div>
            </div>
          );
        })}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
              <span className="ml-1 text-xs text-muted-foreground">{t('typing')}</span>
            </div>
          </div>
        )}
        {/* Item-sold system message (Section 5) — never negotiate a dead listing */}
        {sold && (
          <div className="flex justify-center">
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {t('itemUnavailable')}
            </span>
          </div>
        )}
      </div>

      {/* Make-an-offer quick action (Section 5) */}
      {listingId && !sold && (
        <div className="border-t border-border bg-background px-3 pt-2">
          <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <HandCoins className="h-4 w-4" /> {t('makeOffer')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('makeOffer')}</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  placeholder="0"
                  autoFocus
                />
                <Button onClick={sendOffer} disabled={!offer || sending}>
                  {t('send')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2 border-t border-border bg-background p-3"
      >
        <Textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (e.target.value.trim()) signalTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={t('typePlaceholder')}
          rows={1}
          className="max-h-32 min-h-[44px] resize-none"
        />
        <Button type="submit" size="icon" disabled={sending || !body.trim()} aria-label={t('send')}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
