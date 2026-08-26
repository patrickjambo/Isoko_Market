'use client';

import { User, Wallet, ShieldCheck, LayoutDashboard, LogOut, FileText, Gift, Store, Heart, Package, Briefcase } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { VerifiedBadge } from '@/components/trust/verified-badge';
import { useSession } from '@/components/providers';
import { adoptedWorkspaces, type Workspace } from '@/lib/onboarding';
import { initials } from '@/lib/utils';

export function UserMenu() {
  const t = useTranslations();
  const router = useRouter();
  const user = useSession();
  if (!user) return null;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  // Only the workspaces the user has actually ADOPTED appear here — a buyer sees
  // none and starts selling/hiring from the "+ Post" button (see adoptedWorkspaces).
  const wsLink: Record<Exclude<Workspace, 'buyer'>, { href: string; icon: LucideIcon; label: string }> = {
    employer: { href: '/employer', icon: Briefcase, label: t('employer.dashboard') },
    seller: { href: '/dashboard', icon: Store, label: t('seller.dashboard') },
    seeker: { href: '/cv', icon: FileText, label: t('cv.title') },
  };
  const workspaces = adoptedWorkspaces(user).map((w) => wsLink[w]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar>
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} />}
          <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-sm font-semibold text-foreground">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{user.fullName}</span>
            <VerifiedBadge
              status={user.verificationStatus}
              label={user.isVerified ? t('trust.verifiedBadge') : undefined}
            />
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Adopted workspaces only (role-aware) — a buyer sees none */}
        {workspaces.map((l) => {
          const Icon = l.icon;
          return (
            <DropdownMenuItem key={l.href} asChild>
              <Link href={l.href}>
                <Icon /> {l.label}
              </Link>
            </DropdownMenuItem>
          );
        })}

        {/* Personal items */}
        <DropdownMenuItem asChild>
          <Link href="/orders">
            <Package /> {t('orders.title')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/saved">
            <Heart /> {t('saved.title')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User /> {t('nav.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/wallet">
            <Wallet /> {t('nav.wallet')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/referrals">
            <Gift className="text-accent" /> {t('referrals.title')}
          </Link>
        </DropdownMenuItem>

        {!user.isVerified && (
          <DropdownMenuItem asChild>
            <Link href="/verify">
              <ShieldCheck className="text-accent" /> {t('verification.title')}
            </Link>
          </DropdownMenuItem>
        )}
        {user.role === 'ADMIN' && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboard /> {t('nav.admin')}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-destructive focus:text-destructive">
          <LogOut /> {t('nav.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
