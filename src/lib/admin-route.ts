import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { User } from '@prisma/client';
import { ApiError, statusFor, type ApiErrorCode } from './api';
import { requireUser } from './auth';
import { effectivePermissions } from './permissions';
import { can } from './authz';
import { rateLimit } from './rate-limit';
import { recordRequest } from './metrics';

/**
 * Single gateway for every /api/admin/* route (the spec's `withAdminAuth`).
 * It authenticates the session, requires the ADMIN platform role, checks the
 * specific permission key server-side, rate-limits, and wraps the result in the
 * shared envelope `{ data, meta, error }` so cards, tables and exports can share
 * one fetching hook. Pass `permissionKey: null` for endpoints any admin may hit.
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
      const admin = await requireUser();
      if (admin.role !== 'ADMIN') {
        throw new ApiError('FORBIDDEN', 'Admin access required.');
      }

      // Per-admin rate limit on every admin call.
      const limit = rateLimit(`admin:${admin.id}`, 300, 60 * 1000);
      if (!limit.success) throw new ApiError('RATE_LIMITED', 'Slow down.');

      // Same can() the ownership routes use — admin RBAC is not a separate
      // authorization system (Unified rule 5). Pass the resolved set so we don't
      // refetch it here.
      const permissions = await effectivePermissions(admin);
      if (permissionKey && !(await can(admin, `admin:${permissionKey}`, undefined, { permissions }))) {
        throw new ApiError('FORBIDDEN', `Missing permission: ${permissionKey}`);
      }

      const result = await handler(req, ctx, { admin, permissions });
      // Handlers may return a raw Response (e.g. CSV/file downloads) — pass through.
      if (result instanceof Response) return result;
      return envelope(result?.data, result?.meta, null, 200);
    } catch (err) {
      // Let Next.js control-flow signals (redirect / notFound / dynamic bailout)
      // propagate instead of turning them into an error envelope.
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
