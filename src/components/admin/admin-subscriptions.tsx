'use client';

import { useState, useTransition } from 'react';
import {
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Crown,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { formatRWF } from '@/lib/utils';

type SubscriptionStatus = 'NONE' | 'ACTIVE' | 'EXPIRED' | 'GRACE';
type SubscriptionPlan = 'MONTHLY' | 'ANNUAL' | null;

type SellerRow = {
  id: string;
  fullName: string;
  email: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: SubscriptionPlan;
  subscriptionExpiresAt: string | null;
  createdAt: string;
};

type Stats = {
  totalActive: number;
  totalRevenue: number;
  expiringSoon: number;
};

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const t = useTranslations('subscription');
  const configs: Record<SubscriptionStatus, { label: string; className: string; icon: React.ElementType }> = {
    ACTIVE: {
      label: t('statusActive'),
      className: 'bg-success/15 text-success border-success/20',
      icon: CheckCircle2,
    },
    GRACE: {
      label: t('statusGrace'),
      className: 'bg-amber-500/15 text-amber-600 border-amber-500/20 dark:text-amber-400',
      icon: Clock,
    },
    EXPIRED: {
      label: t('statusExpired'),
      className: 'bg-destructive/15 text-destructive border-destructive/20',
      icon: XCircle,
    },
    NONE: {
      label: t('statusNone'),
      className: 'bg-muted text-muted-foreground border-transparent',
      icon: AlertCircle,
    },
  };

  const { label, className, icon: Icon } = configs[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function AdminSubscriptions({
  sellers: initialSellers,
  stats,
  subscriptionEnabled,
}: {
  sellers: SellerRow[];
  stats: Stats;
  subscriptionEnabled: boolean;
}) {
  const t = useTranslations('subscription');
  const tc = useTranslations('common');
  const router = useRouter();
  const { toast } = useToast();
  const [sellers, setSellers] = useState<SellerRow[]>(initialSellers);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [_isPending, startTransition] = useTransition();

  async function handleGrant(userId: string, plan: 'MONTHLY' | 'ANNUAL') {
    setActionUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'grant', plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? tc('error'));

      setSellers((prev) =>
        prev.map((s) =>
          s.id === userId
            ? {
                ...s,
                subscriptionStatus: 'ACTIVE',
                subscriptionPlan: plan,
                subscriptionExpiresAt: data.data?.subscriptionExpiresAt ?? s.subscriptionExpiresAt,
              }
            : s
        )
      );
      toast(t('grantSub'), 'success');
      startTransition(() => router.refresh());
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('error'), 'error');
    } finally {
      setActionUserId(null);
    }
  }

  async function handleRevoke(userId: string) {
    setActionUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? tc('error'));

      setSellers((prev) =>
        prev.map((s) =>
          s.id === userId
            ? { ...s, subscriptionStatus: 'EXPIRED', subscriptionPlan: null, subscriptionExpiresAt: null }
            : s
        )
      );
      toast(t('revokeSub'), 'success');
      startTransition(() => router.refresh());
    } catch (err) {
      toast(err instanceof Error ? err.message : tc('error'), 'error');
    } finally {
      setActionUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
              <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.totalActive}</p>
              <p className="text-sm text-muted-foreground">{t('totalActive')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950/40">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatRWF(stats.totalRevenue)}</p>
              <p className="text-sm text-muted-foreground">{t('totalRevenue')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/40">
              <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.expiringSoon}</p>
              <p className="text-sm text-muted-foreground">{t('expiringSoon')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Not enabled notice */}
      {!subscriptionEnabled && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Seller subscriptions are currently disabled in settings.</span>
        </div>
      )}

      {/* Sellers table */}
      {sellers.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          <Crown className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">No subscription records yet</p>
          <p className="text-sm">Sellers who subscribe will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Seller</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Plan</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Expires</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((seller) => {
                const isLoading = actionUserId === seller.id;
                const isActive = seller.subscriptionStatus === 'ACTIVE';
                return (
                  <tr key={seller.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{seller.fullName}</p>
                      <p className="text-xs text-muted-foreground">{seller.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={seller.subscriptionStatus} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {seller.subscriptionPlan
                        ? seller.subscriptionPlan === 'MONTHLY'
                          ? t('planMonthly')
                          : t('planAnnual')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {seller.subscriptionExpiresAt
                        ? new Date(seller.subscriptionExpiresAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : isActive ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRevoke(seller.id)}
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            {t('revokeSub')}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGrant(seller.id, 'MONTHLY')}
                          >
                            {t('grantSub')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
