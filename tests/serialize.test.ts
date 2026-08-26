import { describe, it, expect } from 'vitest';
import type { User } from '@prisma/client';
import { toPublicUser, toSessionUser } from '@/lib/serialize';

// A full-ish User row, including sensitive fields that must NEVER be serialized
// out to a client (Section 10 — passwordHash / raw idDocumentUrl).
const user = {
  id: 'u1',
  fullName: 'Patrick Jambo',
  avatarUrl: null,
  location: 'Kigali',
  role: 'SELLER',
  isVerified: true,
  verificationStatus: 'VERIFIED',
  createdAt: new Date('2026-01-02T03:04:05.000Z'),
  lastActiveAt: new Date('2026-08-01T00:00:00.000Z'),
  phone: '+250788123456',
  locale: 'rw',
  walletBalance: 5000,
  idDocumentUrl: 'enc://id-object-key',
  preferredRole: 'seller',
  passwordHash: 'SUPER_SECRET_HASH', // must not leak
} as unknown as User;

const PUBLIC_KEYS = [
  'id',
  'fullName',
  'avatarUrl',
  'location',
  'role',
  'isVerified',
  'verificationStatus',
  'createdAt',
  'lastActiveAt',
].sort();

describe('toPublicUser', () => {
  it('exposes exactly the public-safe fields, nothing sensitive', () => {
    const pub = toPublicUser(user);
    expect(Object.keys(pub).sort()).toEqual(PUBLIC_KEYS);
    expect(pub).not.toHaveProperty('passwordHash');
    expect(pub).not.toHaveProperty('idDocumentUrl');
    expect(pub).not.toHaveProperty('phone');
    expect(pub).not.toHaveProperty('walletBalance');
  });

  it('serializes dates to ISO strings and preserves a null lastActiveAt', () => {
    expect(toPublicUser(user).createdAt).toBe('2026-01-02T03:04:05.000Z');
    expect(toPublicUser(user).lastActiveAt).toBe('2026-08-01T00:00:00.000Z');
    expect(toPublicUser({ ...user, lastActiveAt: null } as User).lastActiveAt).toBeNull();
  });
});

describe('toSessionUser', () => {
  it('adds owner-only fields but still hides raw secrets', () => {
    const s = toSessionUser(user);
    expect(s.phone).toBe('+250788123456');
    expect(s.walletBalance).toBe(5000);
    expect(s.locale).toBe('rw');
    expect(s.preferredRole).toBe('seller');
    // The ID doc is reduced to a boolean — the raw object key never leaves the server.
    expect(s.hasIdDocument).toBe(true);
    expect(s).not.toHaveProperty('idDocumentUrl');
    expect(s).not.toHaveProperty('passwordHash');
  });

  it('reports hasIdDocument=false and preferredRole=null when unset', () => {
    const s = toSessionUser({ ...user, idDocumentUrl: null, preferredRole: null } as User);
    expect(s.hasIdDocument).toBe(false);
    expect(s.preferredRole).toBeNull();
  });
});
