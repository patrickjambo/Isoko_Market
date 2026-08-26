import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { User } from '@prisma/client';
import { ApiError, statusFor } from './api';
import { requireUser } from './auth';
import { recordRequest } from './metrics';

/**
 * Authenticated route wrapper returning the SAME envelope as adminRoute
 * (`{ data, meta, error }`), so buyer, seller and admin endpoints can share one
 * client hook (Section 10 — consistent API envelope).
 */
export type UserContext = { user: User };
export type UserResult = { data?: unknown; meta?: unknown } | Response | void;

function envelope(
  data: unknown,
  meta: unknown,
  error: { code: string; message: string; fields?: Record<string, string> } | null,
  status: number
) {
  return NextResponse.json({ data: data ?? null, meta: meta ?? null, error }, { status });
}

export function userRoute<Ctx = unknown>(
  handler: (req: Request, ctx: Ctx, user: UserContext) => Promise<UserResult>
) {
  return async (req: Request, ctx: Ctx): Promise<Response> => {
    const start = Date.now();
    let errored = false;
    try {
      const user = await requireUser();
      const result = await handler(req, ctx, { user });
      if (result instanceof Response) return result;
      return envelope(result?.data, result?.meta, null, 200);
    } catch (err) {
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
        return envelope(null, null, { code: 'VALIDATION', message: 'Please check the fields.', fields }, 422);
      }
      // eslint-disable-next-line no-console
      console.error('User API error:', err);
      errored = true;
      return envelope(null, null, { code: 'INTERNAL', message: 'Something went wrong.' }, 500);
    } finally {
      recordRequest(Date.now() - start, errored);
    }
  };
}
