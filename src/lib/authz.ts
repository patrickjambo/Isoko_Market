import 'server-only';
import type { User } from '@prisma/client';
import { ApiError } from './api';
import { effectivePermissions } from './permissions';

/**
 * ONE authorization function for the whole platform (Unified rule 5).
 *
 * "Is this admin allowed to run this action?" and "can this seller edit their
 * own listing?" are the same question — is this actor allowed to do this action
 * on this resource? Routing both through `can()` means there is a single place
 * to audit for security holes, not five.
 *
 *   • Admin RBAC   → action `"admin:<permission.key>"` checks effectivePermissions.
 *   • Ownership    → action `"job:close"`, `"listing:edit"`, … checks that the
 *                    actor owns (or is a party to) the given resource.
 */
export type Actor = Pick<User, 'id' | 'role' | 'adminRole'>;

/**
 * For each ownership action, the set of user ids permitted to perform it, read
 * off the resource. Most actions have a single owner; a few (order:view,
 * conversation:access) permit either party.
 */
const OWNERS: Record<string, (r: any) => (string | null | undefined)[]> = {
  // Marketplace listings — the seller owns them.
  'listing:edit': (r) => [r?.sellerId],
  'listing:delete': (r) => [r?.sellerId],
  'listing:setStatus': (r) => [r?.sellerId],
  // Jobs — the employer owns them.
  'job:edit': (r) => [r?.employerId],
  'job:close': (r) => [r?.employerId],
  'job:repost': (r) => [r?.employerId],
  'job:viewApplicants': (r) => [r?.employerId],
  // Applications — the employer decides; the applicant may withdraw their own.
  'application:decide': (r) => [r?.job?.employerId ?? r?.employerId],
  // The employer may view/download the submitted CV; the applicant, their own.
  'application:viewCv': (r) => [r?.job?.employerId ?? r?.employerId, r?.applicantId],
  'application:withdraw': (r) => [r?.applicantId],
  // Orders / escrow — buyer and seller are the two parties.
  'order:view': (r) => [r?.buyerId, r?.sellerId],
  'order:sellerConfirm': (r) => [r?.sellerId],
  'order:confirmReceipt': (r) => [r?.buyerId],
  'order:cancel': (r) => [r?.buyerId],
  'order:review': (r) => [r?.buyerId],
  // Personal records.
  'savedSearch:delete': (r) => [r?.userId],
  'cv:edit': (r) => [r?.userId],
  // Conversations — any participant (participantIds supplied by the caller).
  'conversation:access': (r) => r?.participantIds ?? [],
};

/**
 * @param opts.permissions pre-computed admin permission set, to avoid a second
 *   DB round-trip when the caller (adminRoute) already resolved it.
 */
export async function can(
  actor: Actor | null | undefined,
  action: string,
  resource?: unknown,
  opts?: { permissions?: Set<string> }
): Promise<boolean> {
  if (!actor) return false;

  // Admin RBAC.
  if (action.startsWith('admin:')) {
    if (actor.role !== 'ADMIN') return false;
    const perms = opts?.permissions ?? (await effectivePermissions(actor));
    return perms.has(action.slice('admin:'.length));
  }

  // Ownership / party membership.
  const resolver = OWNERS[action];
  if (resolver) {
    const allowed = resolver(resource).filter((id): id is string => Boolean(id));
    return allowed.includes(actor.id);
  }

  // Unknown action → deny by default (fail closed).
  return false;
}

/** Throwing guard — the terse form for route handlers. Denies fail closed. */
export async function authorize(
  actor: Actor | null | undefined,
  action: string,
  resource?: unknown,
  opts?: { permissions?: Set<string>; message?: string }
): Promise<void> {
  if (!(await can(actor, action, resource, opts))) {
    throw new ApiError('FORBIDDEN', opts?.message ?? 'You are not allowed to do that.');
  }
}
