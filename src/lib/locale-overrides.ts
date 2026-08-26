import 'server-only';
import { unstable_cache } from 'next/cache';
import { prisma } from './prisma';

/** Flatten a nested messages object into dot-path → string entries. */
export function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') Object.assign(out, flatten(v as Record<string, unknown>, key));
    else out[key] = String(v);
  }
  return out;
}

/** Set a dot-path key on a nested object (mutates and returns it). */
export function setDeep(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]!;
    if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
    node = node[p] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]!] = value;
}

/**
 * DB-backed i18n overrides for a locale, cached and tagged so edits in the
 * Content panel take effect without a code deploy (revalidateTag on write).
 */
export const getLocaleOverrides = unstable_cache(
  async (locale: string): Promise<Record<string, string>> => {
    const rows = await prisma.localeString.findMany({ where: { locale }, select: { key: true, value: true } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },
  ['locale-overrides'],
  { tags: ['locale-overrides'], revalidate: 3600 }
);
