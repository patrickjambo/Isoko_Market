'use client';

import { useState } from 'react';
import { Check, X, CheckCircle2, Loader2, Ban } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { initials, timeAgo } from '@/lib/utils';

export type ServiceRequestItem = {
  id: string;
  listingId: string;
  listingTitle: string;
  personName: string;
  personAvatar: string | null;
  note: string | null;
  status: string;
  createdAt: string;
};

const STATUS_VARIANT: Record<string, 'secondary' | 'accent' | 'outline'> = {
  REQUESTED: 'accent',
  CONFIRMED: 'secondary',
  DECLINED: 'outline',
  COMPLETED: 'secondary',
  CANCELLED: 'outline',
};

export function ServiceRequestList({
  incoming,
  outgoing,
  locale,
}: {
  incoming: ServiceRequestItem[];
  outgoing: ServiceRequestItem[];
  locale: string;
}) {
  const t = useTranslations('marketplace');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/service-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast(t(`sr_${status}`), 'success');
      router.refresh();
    } catch {
      toast(tc('error'), 'error');
    } finally {
      setBusy(null);
    }
  }

  const Row = ({ r, provider }: { r: ServiceRequestItem; provider: boolean }) => (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={r.personAvatar ?? undefined} />
        <AvatarFallback>{initials(r.personName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{r.personName}</span>
          <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{t(`sr_${r.status}`)}</Badge>
        </div>
        <Link href={`/marketplace/${r.listingId}`} className="text-sm text-primary hover:underline">
          {r.listingTitle}
        </Link>
        {r.note && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{r.note}</p>}
        <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(r.createdAt, locale)}</p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {provider && r.status === 'REQUESTED' && (
            <>
              <Button size="sm" variant="accent" onClick={() => setStatus(r.id, 'CONFIRMED')} disabled={busy === r.id}>
                {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t('confirmRequest')}
              </Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setStatus(r.id, 'DECLINED')} disabled={busy === r.id}>
                <X className="h-4 w-4" /> {t('declineRequest')}
              </Button>
            </>
          )}
          {provider && r.status === 'CONFIRMED' && (
            <Button size="sm" variant="outline" onClick={() => setStatus(r.id, 'COMPLETED')} disabled={busy === r.id}>
              <CheckCircle2 className="h-4 w-4" /> {t('markCompleted')}
            </Button>
          )}
          {!provider && (r.status === 'REQUESTED' || r.status === 'CONFIRMED') && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setStatus(r.id, 'CANCELLED')} disabled={busy === r.id}>
              <Ban className="h-4 w-4" /> {t('cancelRequest')}
            </Button>
          )}
        </div>
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-lg font-semibold">{t('incomingRequests')}</h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noIncomingRequests')}</p>
        ) : (
          <ul className="space-y-2">
            {incoming.map((r) => (
              <Row key={r.id} r={r} provider />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t('outgoingRequests')}</h2>
        {outgoing.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noOutgoingRequests')}</p>
        ) : (
          <ul className="space-y-2">
            {outgoing.map((r) => (
              <Row key={r.id} r={r} provider={false} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
