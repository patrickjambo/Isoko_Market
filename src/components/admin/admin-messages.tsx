'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageSquareWarning, Eye, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { adminApi } from '@/lib/admin-client';
import { timeAgo } from '@/lib/utils';

type Convo = {
  id: string;
  about: string | null;
  participants: string[];
  messageCount: number;
  lastMessageAt: string;
};
type Msg = { id: string; sender: string; body: string; createdAt: string };

export function AdminMessages({ locale }: { locale: string }) {
  const t = useTranslations('admin');
  const { toast } = useToast();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  useEffect(() => {
    adminApi<{ conversations: Convo[] }>('/api/admin/messages')
      .then(({ data }) => setConvos(data.conversations))
      .catch((e) => toast(e instanceof Error ? e.message : 'error', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  async function open(id: string) {
    setOpenId(id);
    setLoadingMsgs(true);
    setMessages([]);
    try {
      const { data } = await adminApi<{ messages: Msg[] }>(`/api/admin/messages/${id}`);
      setMessages(data.messages);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
      setOpenId(null);
    } finally {
      setLoadingMsgs(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg bg-secondary/50 p-3 text-sm text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        {t('oversightNote')}
      </div>

      {convos.length === 0 ? (
        <EmptyState icon={MessageSquareWarning} title={t('noFlagged')} />
      ) : (
        <ul className="space-y-2">
          {convos.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {c.participants.join(' ↔ ')}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.about ? `${c.about} · ` : ''}
                  {t('messageCount', { count: c.messageCount })} · {timeAgo(c.lastMessageAt, locale)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => open(c.id)}>
                <Eye className="h-4 w-4" /> {t('review')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t('flaggedConversation')}</DialogTitle>
            <DialogDescription>{t('accessLogged')}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {loadingMsgs ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="rounded-lg border border-border/60 p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{m.sender}</span>
                    <time className="text-[11px] text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <p className="text-sm">{m.body}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
