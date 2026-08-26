'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, KeyRound, Check, X, CircleDot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useCan } from '@/components/admin/admin-context';
import { adminApi } from '@/lib/admin-client';
import { initials, cn } from '@/lib/utils';

type Admin = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  adminRole: string | null;
  accountStatus: string;
};
type MatrixRow = {
  key: string;
  roleGrants: boolean;
  source: 'role' | 'override';
  state: 'inherit' | 'grant' | 'deny';
  effective: boolean;
  expiresAt: string | null;
};
type Detail = {
  admin: Admin; // adminRole may be null (no sub-role assigned yet)
  modules: { module: string; keys: string[] }[];
  matrix: MatrixRow[];
};

const ADMIN_ROLES = ['SUPER_ADMIN', 'MODERATOR', 'SUPPORT', 'FINANCE_ADMIN', 'READONLY_ANALYST'];

function humanize(key: string): string {
  const part = key.split('.')[1] ?? key;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export function AdminRoles() {
  const t = useTranslations('admin');
  const can = useCan();
  const { toast } = useToast();
  const canManage = can('roles.manage');

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const loadAdmins = useCallback(async () => {
    try {
      const { data } = await adminApi<{ admins: Admin[] }>('/api/admin/roles');
      setAdmins(data.admins);
      setSelectedId((prev) => prev ?? data.admins[0]?.id ?? null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadDetail = useCallback(
    async (id: string) => {
      setLoadingDetail(true);
      try {
        const { data } = await adminApi<Detail>(`/api/admin/roles/${id}`);
        setDetail(data);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'error', 'error');
      } finally {
        setLoadingDetail(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);
  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  async function setRole(adminRole: string) {
    if (!selectedId) return;
    try {
      await adminApi(`/api/admin/roles/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'setRole', adminRole }),
      });
      toast(t('actionLogged'), 'success');
      await Promise.all([loadAdmins(), loadDetail(selectedId)]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    }
  }

  async function setPermission(key: string, state: 'grant' | 'deny' | 'inherit') {
    if (!selectedId) return;
    setSavingKey(key);
    try {
      const { data } = await adminApi<{ matrix: MatrixRow[] }>(`/api/admin/roles/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'setPermission', permissionKey: key, state }),
      });
      setDetail((d) => (d ? { ...d, matrix: data.matrix } : d));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'error', 'error');
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const rowFor = (key: string) => detail?.matrix.find((m) => m.key === key);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      {/* Admin list */}
      <ul className="space-y-1 rounded-xl border border-border bg-card p-2">
        {admins.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => setSelectedId(a.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors',
                selectedId === a.id ? 'bg-secondary' : 'hover:bg-secondary/50'
              )}
            >
              <Avatar className="h-9 w-9">
                {a.avatarUrl && <AvatarImage src={a.avatarUrl} alt={a.fullName} />}
                <AvatarFallback>{initials(a.fullName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.adminRole ? t(`adminRole_${a.adminRole}`) : t('adminRole_none')}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* Permission matrix */}
      <div className="rounded-xl border border-border bg-card p-4">
        {loadingDetail || !detail ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <span className="font-semibold">{detail.admin.fullName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t('adminRole')}</span>
                <Select
                  value={detail.admin.adminRole ?? ''}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={!canManage}
                  className="h-9 max-w-[200px] text-sm"
                >
                  {!detail.admin.adminRole && (
                    <option value="" disabled>
                      {t('adminRole_none')}
                    </option>
                  )}
                  {ADMIN_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {t(`adminRole_${r}`)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {detail.admin.adminRole === 'SUPER_ADMIN' && (
              <p className="mb-4 rounded-lg bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
                {t('superAdminNote')}
              </p>
            )}

            <div className="space-y-5">
              {detail.modules.map((mod) => (
                <div key={mod.module}>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {t(`module_${mod.module}`)}
                  </h3>
                  <ul className="space-y-1.5">
                    {mod.keys.map((key) => {
                      const row = rowFor(key);
                      const state = row?.state ?? 'inherit';
                      const effective = row?.effective ?? false;
                      return (
                        <li
                          key={key}
                          className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{humanize(key)}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{key}</p>
                          </div>
                          <Badge variant={effective ? 'success' : 'muted'}>
                            {effective ? t('allowed') : t('blocked')}
                          </Badge>
                          <TriToggle
                            state={state}
                            disabled={!canManage || savingKey === key || detail.admin.adminRole === 'SUPER_ADMIN'}
                            saving={savingKey === key}
                            onChange={(s) => setPermission(key, s)}
                            labels={{ inherit: t('inherit'), grant: t('grant'), deny: t('deny') }}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TriToggle({
  state,
  disabled,
  saving,
  onChange,
  labels,
}: {
  state: 'inherit' | 'grant' | 'deny';
  disabled?: boolean;
  saving?: boolean;
  onChange: (s: 'inherit' | 'grant' | 'deny') => void;
  labels: { inherit: string; grant: string; deny: string };
}) {
  const opts: { key: 'inherit' | 'grant' | 'deny'; icon: typeof Check; active: string }[] = [
    { key: 'inherit', icon: CircleDot, active: 'bg-secondary text-foreground' },
    { key: 'grant', icon: Check, active: 'bg-success text-success-foreground' },
    { key: 'deny', icon: X, active: 'bg-destructive text-destructive-foreground' },
  ];
  return (
    <div className="flex shrink-0 overflow-hidden rounded-lg border border-input">
      {opts.map((o) => {
        const Icon = o.icon;
        const isActive = state === o.key;
        return (
          <button
            key={o.key}
            type="button"
            disabled={disabled}
            title={labels[o.key]}
            onClick={() => onChange(o.key)}
            className={cn(
              'flex h-8 w-8 items-center justify-center border-l border-input first:border-l-0 transition-colors disabled:opacity-40',
              isActive ? o.active : 'text-muted-foreground hover:bg-secondary/60'
            )}
          >
            {saving && isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-4 w-4" />}
          </button>
        );
      })}
    </div>
  );
}
