import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { recordRequest } from './metrics';
import { localizeError } from './errors';

/**
 * Consistent JSON contracts for every Route Handler (Section 11).
 * Success: the payload directly. Failure: { error: { code, message, fields? } }.
 */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

const STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export function statusFor(code: ApiErrorCode): number {
  return STATUS[code];
}

export class ApiError extends Error {
  code: ApiErrorCode;
  fields?: Record<string, string>;
  constructor(code: ApiErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.fields = fields;
  }
}

export function jsonError(
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string>
) {
  return NextResponse.json({ error: { code, message, fields } }, { status: STATUS[code] });
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Wrap a Route Handler so thrown ApiError / ZodError become uniform responses. */
export function route<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    const start = Date.now();
    let errored = false;
    try {
      return await fn(...args);
    } catch (err) {
      // Re-throw Next.js control-flow signals (redirect, notFound, and the
      // dynamic-rendering bailout) so the framework can handle them instead of
      // us turning them into a 500.
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
      // Localize the user-facing message into the request's locale (§6.6).
      const locale = await requestLocale();
      const t = (message: string) => localizeError(message, locale);
      if (err instanceof ApiError) {
        return jsonError(err.code, t(err.message), err.fields);
      }
      if (err instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of err.issues) {
          const path = issue.path.join('.');
          if (path && !fields[path]) fields[path] = issue.message;
        }
        return jsonError('VALIDATION', t('Please check the highlighted fields.'), fields);
      }
      // eslint-disable-next-line no-console
      console.error('Unhandled API error:', err);
      errored = true; // only unexpected 5xx count toward the error rate
      return jsonError('INTERNAL', t('Something went wrong. Please try again.'));
    } finally {
      recordRequest(Date.now() - start, errored);
    }
  };
}

/**
 * Resolve the caller's locale from the `NEXT_LOCALE` cookie (set by the i18n
 * middleware and sent with API requests). Dynamically imports `next/headers` so
 * importing this module in a plain Node context (e.g. unit tests) is safe.
 */
async function requestLocale(): Promise<string> {
  try {
    const { cookies } = await import('next/headers');
    const value = cookies().get('NEXT_LOCALE')?.value;
    return value === 'en' || value === 'fr' || value === 'rw' ? value : 'rw';
  } catch {
    return 'rw';
  }
}
