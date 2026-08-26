import { describe, it, expect } from 'vitest';
import { can } from '@/lib/authz';
import { mergeOverrides, roleDefaults } from '@/lib/permissions';

// Minimal actors — can() only reads id/role/adminRole.
const seller = { id: 'u_seller', role: 'SELLER', adminRole: null } as const;
const other = { id: 'u_other', role: 'BUYER', adminRole: null } as const;
const employer = { id: 'u_emp', role: 'EMPLOYER', adminRole: null } as const;
const admin = { id: 'u_admin', role: 'ADMIN', adminRole: 'MODERATOR' } as const;

describe('can() — unified ownership authorization (rule 5)', () => {
  it('lets an owner act on their own resource, denies everyone else', async () => {
    const listing = { sellerId: seller.id };
    expect(await can(seller, 'listing:edit', listing)).toBe(true);
    expect(await can(other, 'listing:edit', listing)).toBe(false);

    const job = { employerId: employer.id };
    expect(await can(employer, 'job:close', job)).toBe(true);
    expect(await can(other, 'job:close', job)).toBe(false);
  });

  it('reads the owner through a nested relation (application → job.employer)', async () => {
    const application = { job: { employerId: employer.id } };
    expect(await can(employer, 'application:decide', application)).toBe(true);
    expect(await can(other, 'application:decide', application)).toBe(false);
  });

  it('lets the hiring employer AND the applicant view the submitted CV, nobody else', async () => {
    const application = { applicantId: seller.id, job: { employerId: employer.id } };
    expect(await can(employer, 'application:viewCv', application)).toBe(true);
    expect(await can(seller, 'application:viewCv', application)).toBe(true); // own CV
    expect(await can(other, 'application:viewCv', application)).toBe(false);
  });

  it('allows either party for shared resources (order:view)', async () => {
    const order = { buyerId: other.id, sellerId: seller.id };
    expect(await can(other, 'order:view', order)).toBe(true);
    expect(await can(seller, 'order:view', order)).toBe(true);
    expect(await can(employer, 'order:view', order)).toBe(false);
  });

  it('distinguishes party-specific order actions', async () => {
    const order = { buyerId: other.id, sellerId: seller.id };
    expect(await can(seller, 'order:sellerConfirm', order)).toBe(true);
    expect(await can(other, 'order:sellerConfirm', order)).toBe(false);
    expect(await can(other, 'order:confirmReceipt', order)).toBe(true);
    expect(await can(seller, 'order:confirmReceipt', order)).toBe(false);
  });

  it('applies conversation participant membership', async () => {
    const convo = { participantIds: ['u_a', 'u_other'] };
    expect(await can(other, 'conversation:access', convo)).toBe(true);
    expect(await can(seller, 'conversation:access', convo)).toBe(false);
  });
});

describe('can() — unified admin RBAC (same function)', () => {
  it('checks the admin permission set for admin: actions', async () => {
    const perms = new Set(['users.ban']);
    expect(await can(admin, 'admin:users.ban', undefined, { permissions: perms })).toBe(true);
    expect(await can(admin, 'admin:users.suspend', undefined, { permissions: perms })).toBe(false);
  });

  it('denies admin actions for non-admin roles even with a permission set', async () => {
    const perms = new Set(['users.ban']);
    expect(await can(seller, 'admin:users.ban', undefined, { permissions: perms })).toBe(false);
  });
});

describe('can() — fails closed', () => {
  it('denies null actors and unknown actions', async () => {
    expect(await can(null, 'listing:edit', { sellerId: 'x' })).toBe(false);
    expect(await can(seller, 'totally:unknown', { sellerId: seller.id })).toBe(false);
  });
});

describe('permission overrides (mergeOverrides)', () => {
  const PAST = new Date(Date.now() - 60_000);
  const FUTURE = new Date(Date.now() + 60_000);

  it('(a) an EXPIRED grant override behaves identically to no override', () => {
    const base = roleDefaults('MODERATOR'); // does not grant transactions.refund
    const withExpired = mergeOverrides(base, [
      { permissionKey: 'transactions.refund', granted: true, expiresAt: PAST },
    ]);
    const withNone = mergeOverrides(base, []);
    expect(withExpired.has('transactions.refund')).toBe(false);
    expect(withNone.has('transactions.refund')).toBe(false);
    // Identical sets.
    expect([...withExpired].sort()).toEqual([...withNone].sort());
    // Sanity: the same grant, still valid, WOULD take effect.
    const withValid = mergeOverrides(base, [
      { permissionKey: 'transactions.refund', granted: true, expiresAt: FUTURE },
    ]);
    expect(withValid.has('transactions.refund')).toBe(true);
  });

  it('(b) a DENY override beats a role-default grant for the same key', () => {
    const base = roleDefaults('MODERATOR'); // grants listings.remove by default
    expect(base.has('listings.remove')).toBe(true);
    const denied = mergeOverrides(base, [
      { permissionKey: 'listings.remove', granted: false, expiresAt: null },
    ]);
    expect(denied.has('listings.remove')).toBe(false);
  });
});

describe('can() — admin action requested by a non-admin', () => {
  it('(c) is denied, never silently passed through to allow', async () => {
    // Even if a permission set somehow contained the key, a non-ADMIN role is
    // denied; and since no ownership resolver matches an "admin:" action, there
    // is no fall-through that could accidentally allow it.
    const perms = new Set(['users.ban']);
    expect(await can(seller, 'admin:users.ban', undefined, { permissions: perms })).toBe(false);
    expect(await can(seller, 'admin:users.ban', { sellerId: seller.id })).toBe(false);
    // Contrast: a real admin with the permission is allowed.
    expect(await can(admin, 'admin:users.ban', undefined, { permissions: perms })).toBe(true);
  });
});
