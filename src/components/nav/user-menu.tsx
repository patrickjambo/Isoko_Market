'use client';

import { User, Wallet, ShieldCheck, LayoutDashboard, LogOut, FileText, Gift, Store, Heart, Package, Briefcase, MessageCircle, Send, BellRing } from 'lucide-react';
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
  const adopted = adoptedWorkspaces(user);
  const workspaces = adopted.map((w) => wsLink[w]);
  const isSeeker = adopted.includes('seeker');

  // A persistent "who you are" indicator: everyone is a buyer, plus each
  // workspace they've adopted (seller / job seeker / employer). Admins are staff.
  const roleChips =
    user.role === 'ADMIN'
      ? [t('roles.admin')]
      : [
          t('roles.buyer'),
          ...(adopted.includes('seller') ? [t('roles.seller')] : []),
          ...(adopted.includes('seeker') ? [t('roles.seeker')] : []),
          ...(adopted.includes('employer') ? [t('roles.employer')] : []),
        ];

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
          <div className="mt-1.5 flex flex-wrap gap-1">
            {roleChips.map((r) => (
              <span
                key={r}
                className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
              >
                {r}
              </span>
            ))}
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

        {/* A job seeker's applications — where shortlisted/interview/hired/rejected
            statuses land live (the CV workspace link is separate). */}
        {isSeeker && (
          <DropdownMenuItem asChild>
            <Link href="/profile/applications">
              <Send /> {t('profile.myApplications')}
            </Link>
          </DropdownMenuItem>
        )}

        {/* Messages — reachable on desktop too (mobile uses the bottom-nav tab).
            Interview invites + employer messages arrive here in real time. */}
        <DropdownMenuItem asChild>
          <Link href="/messages">
            <MessageCircle /> {t('nav.messages')}
          </Link>
        </DropdownMenuItem>

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
          <Link href="/alerts">
            <BellRing /> {t('marketplace.alertsTitle')}
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
