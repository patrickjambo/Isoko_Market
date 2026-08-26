'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Loader2, BadgeCheck, ChevronLeft, ChevronRight, Ban, PauseCircle, PlayCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { useCan } from '@/components/admin/admin-context';
import { adminApi } from '@/lib/admin-client';
import { initials, timeAgo } from '@/lib/utils';

type AdminUser = {
  id: string;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  role: string;
  isVerified: boolean;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  statusReason: string | null;
  createdAt: string;
  lastActiveAt: string | null;
};

const ROLES = ['BUYER', 'SELLER', 'EMPLOYER', 'ADMIN'] as const;
const statusVariant: Record<string, 'success' | 'muted' | 'destructive'> = {
  ACTIVE: 'success',
  SUSPENDED: 'muted',
  BANNED: 'destructive',
};

export function AdminUsers({ locale }: { locale: string }) {
  const t = useTranslations('admin');
  const can = useCan();
  const { toast } = useToast();

  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<{ id: string; action: 'suspend' | 'ban' } | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set('q', q.trim());
      if (roleFilter) sp.set('role', roleFilter);
      sp.set('page', String(page));
      const { data, meta } = await adminApi<{ users: AdminUser[] }>(`/api/admin/users?${sp}`);
      setUsers(data.users);
      setTotal((meta?.total as number) ?? 0);
      setPageSize((meta?.pageSize as number) ?? 20);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setLoading(false);
    }
  }, [q, roleFilter, page, toast]);

  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  async function act(id: string, action: string, actionReason?: string) {
    setSavingId(id);
    try {
      const { data } = await adminApi<{ id: string; accountStatus?: string; isVerified?: boolean }>(
        `/api/admin/users/${id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason: actionReason }),
        }
      );
      setUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                ...(data.accountStatus ? { accountStatus: data.accountStatus as AdminUser['accountStatus'], statusReason: actionReason ?? null } : {}),
                ...(typeof data.isVerified === 'boolean' ? { isVerified: data.isVerified } : {}),
              }
            : u
        )
      );
      toast(t('actionLogged'), 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setSavingId(null);
      setReasonFor(null);
      setReason('');
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder={t('searchUsers')}
            className="pl-9"
          />
        </div>
        <Select
          value={roleFilter}
          onChange={(e) => {
            setPage(1);
            setRoleFilter(e.target.value);
          }}
          className="sm:max-w-[180px]"
        >
          <option value="">{t('allRoles')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`role${r}`)}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        {total} {t('users').toLowerCase()}
      </p>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading && users.length === 0 ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">{t('noUsers')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar>
                    {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.fullName} />}
                    <AvatarFallback>{initials(u.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{u.fullName}</span>
                      {u.isVerified && (
                        <Badge variant="success">
                          <BadgeCheck className="h-3 w-3" />
                        </Badge>
                      )}
                      <Badge variant="outline">{t(`role${u.role}`)}</Badge>
                      {u.accountStatus !== 'ACTIVE' && (
                        <Badge variant={statusVariant[u.accountStatus]}>
                          {t(`status${u.accountStatus}`)}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.phone} · {t('joined')} {timeAgo(u.createdAt, locale)}
                      {u.statusReason ? ` · ${u.statusReason}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(can('verification.approve') || can('verification.reject')) && (
                    <Button
                      variant={u.isVerified ? 'outline' : 'default'}
                      size="sm"
                      disabled={savingId === u.id}
                      onClick={() => act(u.id, u.isVerified ? 'unverify' : 'verify')}
                    >
                      {savingId === u.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : u.isVerified ? (
                        t('unverify')
                      ) : (
                        t('verify')
                      )}
                    </Button>
                  )}

                  {u.accountStatus === 'ACTIVE' ? (
                    <>
                      {can('users.suspend') && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={savingId === u.id}
                          onClick={() => setReasonFor({ id: u.id, action: 'suspend' })}
                        >
                          <PauseCircle className="h-4 w-4" /> {t('suspend')}
                        </Button>
                      )}
                      {can('users.ban') && (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={savingId === u.id}
                          onClick={() => setReasonFor({ id: u.id, action: 'ban' })}
                        >
                          <Ban className="h-4 w-4" /> {t('ban')}
                        </Button>
                      )}
                    </>
                  ) : (
                    can('users.reactivate') && (
                      <Button
                        variant="default"
                        size="sm"
                        disabled={savingId === u.id}
                        onClick={() => act(u.id, 'reactivate')}
                      >
                        <PlayCircle className="h-4 w-4" /> {t('reactivate')}
                      </Button>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Reason dialog for sensitive actions (Section: reason field required) */}
      <Dialog open={reasonFor !== null} onOpenChange={(o) => !o && setReasonFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonFor?.action === 'ban' ? t('ban') : t('suspend')}
            </DialogTitle>
            <DialogDescription>{t('reasonRequired')}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reasonPlaceholder')}
            rows={3}
            autoFocus
          />
          <Button
            variant={reasonFor?.action === 'ban' ? 'destructive' : 'default'}
            disabled={reason.trim().length < 3 || savingId !== null}
            onClick={() => reasonFor && act(reasonFor.id, reasonFor.action, reason.trim())}
          >
            {savingId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('confirmAction')}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
