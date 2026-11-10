import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { User } from '@prisma/client';
import { ApiError, statusFor, type ApiErrorCode } from './api';
import { requireUser } from './auth';
import { effectivePermissions } from './permissions';
import { can } from './authz';
import { rateLimit } from './rate-limit';
import { recordRequest } from './metrics';
import { ensureStaffRole } from './staff';

/**
 * Single gateway for every /api/admin/* route.
 * Authenticates, checks admin role + specific permission, rate-limits,
 * and wraps the result in the shared envelope { data, meta, error }.
 * Pass permissionKey: null for endpoints any admin may hit.
 */
export type AdminContext = { admin: User; permissions: Set<string> };
export type AdminResult = { data?: unknown; meta?: unknown } | Response | void;

function envelope(
  data: unknown,
  meta: unknown,
  error: { code: string; message: string; fields?: Record<string, string> } | null,
  status: number
) {
  return NextResponse.json({ data: data ?? null, meta: meta ?? null, error }, { status });
}

export function adminRoute<Ctx = unknown>(
  permissionKey: string | null,
  handler: (req: Request, ctx: Ctx, admin: AdminContext) => Promise<AdminResult>
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const start = Date.now();
    let errored = false;
    try {
      // ── 1. Auth ────────────────────────────────────────────────────────
      let admin = await requireUser();
      if (admin.role !== 'ADMIN') {
        throw new ApiError('FORBIDDEN', 'Admin access required.');
      }

      // ── 2. Self-heal adminRole ─────────────────────────────────────────
      // ensureStaffRole now corrects wrong roles too — if the DB has MODERATOR
      // but the email is in ADMIN_EMAILS it becomes SUPER_ADMIN automatically.
      // Skipped (no DB write) when the role is already correct.
      admin = await ensureStaffRole(admin);

      // ── 3. Rate limit ──────────────────────────────────────────────────
      const limit = rateLimit(`admin:${admin.id}`, 300, 60 * 1000);
      if (!limit.success) throw new ApiError('RATE_LIMITED', 'Slow down.');

      // ── 4. Permission check ────────────────────────────────────────────
      const permissions = await effectivePermissions(admin);
      if (permissionKey && !(await can(admin, `admin:${permissionKey}`, undefined, { permissions }))) {
        throw new ApiError('FORBIDDEN', `Missing permission: ${permissionKey}`);
      }

      // ── 5. Handler ─────────────────────────────────────────────────────
      const result = await handler(req, ctx, { admin, permissions });
      if (result instanceof Response) return result;
      return envelope(result?.data, result?.meta, null, 200);
    } catch (err) {
      // Let Next.js control-flow signals propagate
      if (
        err &&
        typeof err === 'object' &&
        'digest' in err &&
        typeof (err as { digest: unknown }).digest === 'string' &&
        ((err as { digest: string }).digest.startsWith('NEXT_') ||
          (err as { digest: string }).digest === 'DYNAMIC_SERVER_USAGE')
      ) {
        throw err;
      }
      if (err instanceof ApiError) {
        return envelope(null, null, { code: err.code, message: err.message, fields: err.fields }, statusFor(err.code));
      }
      if (err instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of err.issues) {
          const path = issue.path.join('.');
          if (path && !fields[path]) fields[path] = issue.message;
        }
        return envelope(null, null, { code: 'VALIDATION', message: 'Please check the fields.', fields }, statusFor('VALIDATION' as ApiErrorCode));
      }
      // eslint-disable-next-line no-console
      console.error('Admin API error:', err);
      errored = true;
      return envelope(null, null, { code: 'INTERNAL', message: 'Something went wrong.' }, 500);
    } finally {
      recordRequest(Date.now() - start, errored);
    }
  };
}
