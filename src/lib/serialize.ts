import type { User } from '@prisma/client';

/**
 * Public-safe view of a user. NEVER leak passwordHash, idDocumentUrl or raw
 * contact details to the client beyond what a profile should show.
 */
export type PublicUser = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  location: string | null;
  role: User['role'];
  isVerified: boolean;
  verificationStatus: User['verificationStatus'];
  createdAt: string;
  lastActiveAt: string | null;
};

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    location: user.location,
    role: user.role,
    isVerified: user.isVerified,
    verificationStatus: user.verificationStatus,
    createdAt: user.createdAt.toISOString(),
    lastActiveAt: user.lastActiveAt ? user.lastActiveAt.toISOString() : null,
  };
}

/** The current user, plus the private-ish fields the owner is allowed to see. */
export type SessionUser = PublicUser & {
  phone: string;
  locale: User['locale'];
  walletBalance: number;
  hasIdDocument: boolean;
  preferredRole: string | null; // onboarding intent — lets the nav mirror landingFor()
};

export function toSessionUser(user: User): SessionUser {
  return {
    ...toPublicUser(user),
    phone: user.phone,
    locale: user.locale,
    walletBalance: user.walletBalance,
    hasIdDocument: Boolean(user.idDocumentUrl),
    preferredRole: user.preferredRole ?? null,
  };
}
