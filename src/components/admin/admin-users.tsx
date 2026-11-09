'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Loader2,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Ban,
  PauseCircle,
  PlayCircle,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  Copy,
  Check,
  Filter,
  Users,
  Calendar,
  Lock,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { useCan } from '@/components/admin/admin-context';
import { adminApi } from '@/lib/admin-client';
import { initials, timeAgo } from '@/lib/utils';

export type AdminUser = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  country: string | null;
  nationalId: string | null;
  verifiedAt: string | null;
  role: string;
  adminRole: string | null;
  isVerified: boolean;
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  statusReason: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  verificationRequest?: {
    reviewedAt?: string | null;
    reviewNote?: string | null;
    reviewedBy?: { id: string; fullName: string; email: string | null } | null;
  } | null;
};

const ROLES = ['BUYER', 'SELLER', 'EMPLOYER', 'ADMIN'] as const;
const statusVariant: Record<string, 'success' | 'muted' | 'destructive'> = {
  ACTIVE: 'success',
  SUSPENDED: 'muted',
  BANNED: 'destructive',
};

/**
 * Masks a 16-digit Rwandan national ID for privacy: 11995800****5024
 */
function maskNationalId(id: string | null): string {
  if (!id) return 'Not recorded';
  const clean = id.replace(/\s+/g, '');
  if (clean.length < 8) return clean;
  return `${clean.slice(0, 8)}****${clean.slice(-4)}`;
}

export function AdminUsers({ locale }: { locale: string }) {
  const t = useTranslations('admin');
  const can = useCan();
  const { toast } = useToast();

  const canExport = can('users.export') || can('users.view') || can('*');
  const canExportSensitive = can('users.export_sensitive') || can('*');

  // Active view tab: 'all' | 'verified'
  const [activeTab, setActiveTab] = useState<'all' | 'verified'>('all');

  // Filters & Pagination
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Revealed national IDs (set of user IDs whose nationalId is unmasked in UI)
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  // Copied indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Action dialogs
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<{ id: string; action: 'suspend' | 'ban' } | null>(null);
  const [reason, setReason] = useState('');

  // Export Modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'filtered' | 'selected'>('all');
  const [includeSensitiveId, setIncludeSensitiveId] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set('q', q.trim());
      if (roleFilter) sp.set('role', roleFilter);
      if (statusFilter) sp.set('status', statusFilter);
      if (activeTab === 'verified') sp.set('verifiedOnly', 'true');
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
  }, [q, roleFilter, statusFilter, activeTab, page, toast]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  // Selection helpers
  const allPageIds = users.map((u) => u.id);
  const isAllPageSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));

  function toggleSelectAllPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        allPageIds.forEach((id) => next.delete(id));
      } else {
        allPageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function toggleSelectUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleRevealId(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast('Copied to clipboard', 'success');
  }

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
                ...(data.accountStatus
                  ? {
                      accountStatus: data.accountStatus as AdminUser['accountStatus'],
                      statusReason: actionReason ?? null,
                    }
                  : {}),
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

  // Export to Excel handler
  async function triggerExport() {
    setExporting(true);
    try {
      const payload: Record<string, any> = {
        includeSensitiveId: Boolean(includeSensitiveId && canExportSensitive),
      };

      if (exportScope === 'selected' && selectedIds.size > 0) {
        payload.userIds = Array.from(selectedIds);
      } else if (exportScope === 'filtered') {
        if (q.trim()) payload.q = q.trim();
        if (roleFilter) payload.role = roleFilter;
        if (statusFilter) payload.status = statusFilter;
        if (activeTab === 'verified') payload.verifiedOnly = true;
      } else {
        // 'all'
        if (activeTab === 'verified') payload.verifiedOnly = true;
      }

      const res = await fetch('/api/admin/users/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || 'Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 10);
      a.download = `zenova-${activeTab === 'verified' ? 'verified-users' : 'users'}-${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast('Excel spreadsheet (.xlsx) downloaded successfully', 'success');
      setExportModalOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* Top Header & Tabs Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActiveTab(val as 'all' | 'verified');
            setPage(1);
            setSelectedIds(new Set());
          }}
          className="w-full sm:w-auto"
        >
          <TabsList className="bg-slate-100 p-1">
            <TabsTrigger value="all" className="text-xs font-semibold gap-1.5 px-3 py-1.5">
              <Users className="h-3.5 w-3.5" /> All Users
            </TabsTrigger>
            <TabsTrigger value="verified" className="text-xs font-semibold gap-1.5 px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Verified Users Directory
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Export Button */}
        {canExport && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1.5 shadow-sm"
              onClick={() => {
                setExportScope(selectedIds.size > 0 ? 'selected' : 'all');
                setExportModalOpen(true);
              }}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Export to Excel (.xlsx)
              {selectedIds.size > 0 && ` (${selectedIds.size})`}
            </Button>
          </div>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder={
              activeTab === 'verified'
                ? 'Search by name, email, phone, 16-digit ID, or account ID...'
                : t('searchUsers')
            }
            className="pl-9 text-xs sm:text-sm"
          />
        </div>

        <Select
          value={roleFilter}
          onChange={(e) => {
            setPage(1);
            setRoleFilter(e.target.value);
          }}
          className="sm:max-w-[170px] text-xs"
        >
          <option value="">{t('allRoles')}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`role${r}`)}
            </option>
          ))}
        </Select>

        <Select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value);
          }}
          className="sm:max-w-[170px] text-xs"
        >
          <option value="">All Account Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="BANNED">Banned</option>
        </Select>
      </div>

      {/* Floating Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs text-emerald-900 shadow-sm animate-in fade-in">
          <span className="font-semibold">
            {selectedIds.size} user{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100"
              onClick={() => {
                setExportScope('selected');
                setExportModalOpen(true);
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Export Selected (.xlsx)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-emerald-700 hover:text-emerald-900"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Users Count Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {users.length} of {total} {activeTab === 'verified' ? 'verified customers' : t('users').toLowerCase()}
        </span>
        {activeTab === 'verified' && (
          <span className="text-emerald-600 font-medium flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> All users verified via official National ID
          </span>
        )}
      </div>

      {/* MAIN DATA TABLE / LIST */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        {loading && users.length === 0 ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading users directory...
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground space-y-2">
            <Users className="h-8 w-8 mx-auto text-slate-300" />
            <p>{activeTab === 'verified' ? 'No verified users match your filters' : t('noUsers')}</p>
          </div>
        ) : activeTab === 'verified' ? (
          /* TAB 2: VERIFIED USERS DEDICATED TABLE (Section 2.3) */
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-border select-none">
              <tr>
                <th className="p-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAllPage}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    {isAllPageSelected ? (
                      <CheckSquare className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="p-3">Full Name &amp; Email</th>
                <th className="p-3">National ID Number</th>
                <th className="p-3">Country</th>
                <th className="p-3">Customer Account ID</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3">Verified Date</th>
                <th className="p-3">Approving Admin</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                const isSelected = selectedIds.has(u.id);
                const isRevealed = revealedIds.has(u.id);
                const displayId = isRevealed ? u.nationalId : maskNationalId(u.nationalId);
                const reviewer = u.verificationRequest?.reviewedBy;

                return (
                  <tr
                    key={u.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isSelected ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSelectUser(u.id)}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </td>

                    {/* 1. Full Name & Email */}
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.fullName} />}
                          <AvatarFallback>{initials(u.fullName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-1">
                            {u.fullName}
                            <BadgeCheck className="h-3.5 w-3.5 text-emerald-600 inline" />
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                            {u.email || u.phone || 'No email'}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. National ID Number */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-slate-800 bg-slate-100 px-2 py-1 rounded w-fit border border-slate-200">
                        <span>{displayId || 'Not stored'}</span>
                        {u.nationalId && (
                          <button
                            type="button"
                            onClick={() => toggleRevealId(u.id)}
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                            title={isRevealed ? 'Mask ID' : 'Reveal ID'}
                          >
                            {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* 3. Country */}
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {u.country || 'Rwanda'}
                      </Badge>
                    </td>

                    {/* 4. Customer Account ID */}
                    <td className="p-3 font-mono text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[120px]">{u.id}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(u.id, u.id)}
                          className="text-slate-400 hover:text-slate-600 p-0.5"
                          title="Copy Account ID"
                        >
                          {copiedId === u.id ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* 5. Verification Status */}
                    <td className="p-3 text-center">
                      <Badge variant="success" className="text-[10px] font-bold">
                        VERIFIED
                      </Badge>
                    </td>

                    {/* 6. Verification Date */}
                    <td className="p-3 text-slate-600 whitespace-nowrap">
                      {u.verifiedAt
                        ? new Date(u.verifiedAt).toLocaleDateString(locale, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : u.verificationRequest?.reviewedAt
                          ? new Date(u.verificationRequest.reviewedAt).toLocaleDateString(locale)
                          : 'Recorded'}
                    </td>

                    {/* 7. Approving Administrator */}
                    <td className="p-3 text-slate-700 whitespace-nowrap">
                      {reviewer ? (
                        <span className="text-[11px] font-medium text-slate-800">
                          {reviewer.fullName || reviewer.email}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Platform Trust Team</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      {(can('verification.approve') || can('verification.reject')) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                          disabled={savingId === u.id}
                          onClick={() => act(u.id, 'unverify')}
                        >
                          {savingId === u.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            t('unverify')
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* TAB 1: ALL USERS DIRECTORY VIEW */
          <ul className="divide-y divide-border">
            {users.map((u) => {
              const isSelected = selectedIds.has(u.id);

              return (
                <li
                  key={u.id}
                  className={`flex flex-col gap-3 p-3 sm:flex-row sm:items-center hover:bg-slate-50/60 transition-colors ${
                    isSelected ? 'bg-emerald-50/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelectUser(u.id)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                    <Avatar className="h-9 w-9">
                      {u.avatarUrl && <AvatarImage src={u.avatarUrl} alt={u.fullName} />}
                      <AvatarFallback>{initials(u.fullName)}</AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-slate-900">{u.fullName}</span>
                      {u.isVerified && (
                        <Badge variant="success" className="gap-1 text-[10px] py-0">
                          <BadgeCheck className="h-3 w-3" /> Verified
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {t(`role${u.role}`)}
                      </Badge>
                      {u.accountStatus !== 'ACTIVE' && (
                        <Badge variant={statusVariant[u.accountStatus]} className="text-[10px]">
                          {t(`status${u.accountStatus}`)}
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground mt-0.5">
                      {u.email ? `${u.email} · ` : ''}
                      {u.phone ? `${u.phone} · ` : ''}
                      {t('joined')} {timeAgo(u.createdAt, locale)}
                      {u.country ? ` · ${u.country}` : ''}
                      {u.statusReason ? ` · ${u.statusReason}` : ''}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {(can('verification.approve') || can('verification.reject')) && (
                      <Button
                        variant={u.isVerified ? 'outline' : 'default'}
                        size="sm"
                        disabled={savingId === u.id}
                        onClick={() => act(u.id, u.isVerified ? 'unverify' : 'verify')}
                        className="text-xs h-8"
                      >
                        {savingId === u.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
                            className="text-xs h-8"
                          >
                            <PauseCircle className="h-3.5 w-3.5 mr-1" /> {t('suspend')}
                          </Button>
                        )}
                        {can('users.ban') && (
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={savingId === u.id}
                            onClick={() => setReasonFor({ id: u.id, action: 'ban' })}
                            className="text-xs h-8"
                          >
                            <Ban className="h-3.5 w-3.5 mr-1" /> {t('ban')}
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
                          className="text-xs h-8"
                        >
                          <PlayCircle className="h-3.5 w-3.5 mr-1" /> {t('reactivate')}
                        </Button>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination controls */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Suspend / Ban Confirmation Dialog */}
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
            {savingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('confirmAction')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* EXPORT TO EXCEL MODAL (Section 2.4) */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Export Users to Excel (.xlsx)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Download properly formatted spreadsheet with organized customer records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-800">Export Scope</Label>
              <div className="grid grid-cols-1 gap-2">
                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    exportScope === 'all'
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    checked={exportScope === 'all'}
                    onChange={() => setExportScope('all')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-semibold">
                      Export All {activeTab === 'verified' ? 'Verified' : ''} Users
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Downloads all records currently in the database.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    exportScope === 'filtered'
                      ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    checked={exportScope === 'filtered'}
                    onChange={() => setExportScope('filtered')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-semibold">Export Filtered Search Results</div>
                    <div className="text-[11px] text-muted-foreground">
                      Applies current filters (query &apos;{q || 'none'}&apos;, role &apos;
                      {roleFilter || 'all'}&apos;, status &apos;{statusFilter || 'all'}&apos;).
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedIds.size === 0
                      ? 'opacity-50 cursor-not-allowed border-slate-200'
                      : exportScope === 'selected'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950'
                        : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    disabled={selectedIds.size === 0}
                    checked={exportScope === 'selected'}
                    onChange={() => setExportScope('selected')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-semibold">
                      Export Selected Users Only ({selectedIds.size} selected)
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Exports only the specific users you checked with checkboxes.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Included Columns Description */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-1">
              <span className="font-semibold text-slate-700 block">Spreadsheet Columns (.xlsx):</span>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                1. Full Name · 2. Email Address · 3. Country · 4. Customer Account ID · 5. Account Status ·
                6. Verification Status · 7. Registration Date
              </p>
            </div>

            {/* Authorized Staff Sensitive Export Option */}
            {canExportSensitive && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-1.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSensitiveId}
                    onChange={(e) => setIncludeSensitiveId(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="font-semibold text-amber-900 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Include Verified National ID Numbers (Column 8)
                    </span>
                    <span className="block text-[11px] text-amber-700 leading-tight">
                      Authorized compliance export. This action will be recorded in the security audit log.
                    </span>
                  </div>
                </label>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportModalOpen(false)}
              disabled={exporting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={triggerExport}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download Spreadsheet (.xlsx)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
