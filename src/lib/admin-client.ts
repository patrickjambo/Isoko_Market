/**
 * Shared client for the admin envelope `{ data, meta, error }`. All admin
 * dashboard components fetch through this so cards, tables and exports handle
 * responses uniformly.
 */
export type AdminEnvelope<T> = { data: T; meta: Record<string, unknown> | null };

export async function adminApi<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<AdminEnvelope<T>> {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message ?? `Request failed (${res.status})`);
  }
  return { data: json.data as T, meta: json.meta ?? null };
}

/** Same envelope client, named generically for buyer/seller (non-admin) code. */
export const apiFetch = adminApi;
