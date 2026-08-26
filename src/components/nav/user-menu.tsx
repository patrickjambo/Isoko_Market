'use client';

import { User, Wallet, ShieldCheck, LayoutDashboard, LogOut, FileText, Gift, Store, Heart, Package, Briefcase } from 'lucide-react';
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
import { primaryWorkspace } from '@/lib/onboarding';
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

  // Role-aware ordering (mirrors landingFor) so the user's own workspace is
  // ranked first and "Seller dashboard" is never prioritized for non-sellers.
  // Every workspace stays reachable ("not locked in") — the non-primary ones
  // move below a separator as discovery entries.
  const ws = primaryWorkspace(user);
  const sellerLink = { href: '/dashboard', icon: Store, label: t('seller.dashboard') };
  const employerLink = { href: '/employer', icon: Briefcase, label: t('employer.dashboard') };
  const cvLink = { href: '/cv', icon: FileText, label: t('cv.title') };

  // Primary workspace shown at the very top (buyers have none).
  const primary =
    ws === 'seller' ? [sellerLink] : ws === 'employer' ? [employerLink] : ws === 'seeker' ? [cvLink] : [];
  // The remaining workspaces (still reachable, just de-prioritized below).
  const secondary = [sellerLink, employerLink, cvLink].filter(
    (l) => !primary.some((p) => p.href === l.href)
  );

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

        {/* Primary workspace (role-aware, top) */}
        {primary.map((l) => {
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

        {/* Other workspaces — reachable ("not locked in") but de-prioritized */}
        <DropdownMenuSeparator />
        {secondary.map((l) => {
          const Icon = l.icon;
          return (
            <DropdownMenuItem key={l.href} asChild>
              <Link href={l.href}>
                <Icon /> {l.label}
              </Link>
            </DropdownMenuItem>
          );
        })}

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
