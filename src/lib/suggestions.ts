import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Shared autocomplete / suggestion engine (Section 4). All queries run against
 * REAL listing data via pg_trgm similarity — never hardcoded placeholders — and
 * are reused by both marketplace listings and (future) job postings.
 */

export type TitleSuggestion = { value: string; type: 'title' | 'category' };

/**
 * Title autocomplete. With `context='job'` it draws from historical JOB titles
 * (Employer §3 Step 2), so employer-entered and seeker-searched job titles
 * converge on one vocabulary — which is what makes match scoring meaningful.
 * Otherwise it draws from marketplace listing titles + categories.
 */
export async function suggestTitles(
  q: string,
  locale = 'en',
  context: 'listing' | 'job' = 'listing'
): Promise<TitleSuggestion[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  if (context === 'job') {
    const rows = await prisma.$queryRaw<{ title: string }[]>`
      SELECT DISTINCT title, similarity(title, ${query}) AS sim
      FROM "Job"
      WHERE title ILIKE ${'%' + query + '%'} OR title % ${query}
      ORDER BY sim DESC
      LIMIT 6`;
    return rows.map((r) => ({ value: r.title, type: 'title' as const }));
  }

  const nameCol =
    locale === 'rw' ? Prisma.sql`"nameRw"` : locale === 'fr' ? Prisma.sql`"nameFr"` : Prisma.sql`"nameEn"`;

  const [titles, categories] = await Promise.all([
    // ILIKE substring match (accelerated by the trigram GIN index), ranked by
    // trigram similarity — better than whole-string `%` for short autocomplete
    // queries like "gala" → "Samsung Galaxy A14".
    prisma.$queryRaw<{ title: string }[]>`
      SELECT DISTINCT title, similarity(title, ${query}) AS sim
      FROM "Listing"
      WHERE status IN ('ACTIVE', 'SOLD')
        AND (title ILIKE ${'%' + query + '%'} OR title % ${query})
      ORDER BY sim DESC
      LIMIT 5`,
    prisma.$queryRaw<{ name: string }[]>`
      SELECT ${nameCol} AS name FROM "Category"
      WHERE ${nameCol} ILIKE ${'%' + query + '%'}
      LIMIT 3`,
  ]);

  const seen = new Set<string>();
  const out: TitleSuggestion[] = [];
  for (const c of categories) if (!seen.has(c.name)) (seen.add(c.name), out.push({ value: c.name, type: 'category' }));
  for (const t of titles) if (!seen.has(t.title)) (seen.add(t.title), out.push({ value: t.title, type: 'title' }));
  return out.slice(0, 5);
}

/** Suggested price range from similar active + sold listings (never auto-set). */
/**
 * ONE shared "suggest a number from similar recent records" engine (Rule 3).
 * Computes an identical stat set — count, min, P25, median, P75, max — over any
 * table/value-column/filter, so the listing price hint and the job pay hint use
 * the SAME statistics instead of two separately-written aggregation queries that
 * could silently diverge. Values are stored in RWF minor units → returned as
 * whole RWF. Each caller then presents the fields its UI needs.
 */
async function numericRange(
  table: Prisma.Sql,
  value: Prisma.Sql,
  where: Prisma.Sql
): Promise<{
  count: number;
  min: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  max: number | null;
}> {
  const rows = await prisma.$queryRaw<
    { count: bigint; min: number | null; p25: number | null; median: number | null; p75: number | null; max: number | null }[]
  >`
    SELECT
      count(*) AS count,
      min(${value}) AS min,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY ${value}) AS p25,
      percentile_cont(0.5)  WITHIN GROUP (ORDER BY ${value}) AS median,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY ${value}) AS p75,
      max(${value}) AS max
    FROM ${table}
    WHERE ${where}`;
  const r = rows[0];
  const toFrancs = (v: number | null | undefined) => (v == null ? null : Math.round(v / 100));
  return {
    count: Number(r?.count ?? 0),
    min: toFrancs(r?.min),
    p25: toFrancs(r?.p25),
    median: toFrancs(r?.median),
    p75: toFrancs(r?.p75),
    max: toFrancs(r?.max),
  };
}

/** Suggested listing price: median (typical) + full min–max range. */
export async function suggestPrice(categoryId: string, location?: string) {
  const locPattern = location ? `%${location.split(',')[0]!.trim()}%` : null;
  const s = await numericRange(
    Prisma.sql`"Listing"`,
    Prisma.sql`price`,
    Prisma.sql`"categoryId" = ${categoryId} AND status IN ('ACTIVE', 'SOLD') AND (${locPattern}::text IS NULL OR location ILIKE ${locPattern})`
  );
  if (s.count < 2) return { count: s.count, min: null, max: null, median: null };
  return { count: s.count, min: s.min, max: s.max, median: s.median };
}

/**
 * Suggested pay range from recent postings of the same type/location (Employer
 * §3 Step 3) — the jobs mirror of {@link suggestPrice}. Returns whole RWF, never
 * auto-set. Uses payMax/payMin across comparable OPEN + CLOSED jobs.
 */
/**
 * Suggested job pay: the interquartile band (P25–P75) of comparable postings —
 * a "typical pay" range that ignores outliers. Same engine as suggestPrice; a
 * job's representative pay is COALESCE(payMin, payMax).
 */
export async function suggestJobPay(type: 'JOB' | 'GIG', location?: string) {
  const locPattern = location ? `%${location.split(',')[0]!.trim()}%` : null;
  const s = await numericRange(
    Prisma.sql`"Job"`,
    Prisma.sql`COALESCE("payMin", "payMax")`,
    Prisma.sql`type = ${type}::"JobType" AND ("payMin" IS NOT NULL OR "payMax" IS NOT NULL) AND (${locPattern}::text IS NULL OR location ILIKE ${locPattern})`
  );
  if (s.count < 2 || s.p25 == null || s.p75 == null) return { count: s.count, min: null, max: null };
  return { count: s.count, min: s.p25, max: s.p75 };
}

/** Most-used tags in a category, as tappable chip suggestions. */
export async function suggestTags(categoryId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ tag: string }[]>`
    SELECT tag, count(*) AS c
    FROM "Listing", unnest(tags) AS tag
    WHERE "categoryId" = ${categoryId} AND status IN ('ACTIVE', 'SOLD')
    GROUP BY tag ORDER BY c DESC LIMIT 6`;
  return rows.map((r) => r.tag);
}

/** Warn about a near-identical active listing by the same seller before publish. */
export async function findDuplicate(sellerId: string, title: string) {
  const rows = await prisma.$queryRaw<{ id: string; title: string; sim: number }[]>`
    SELECT id, title, similarity(title, ${title}) AS sim
    FROM "Listing"
    WHERE "sellerId" = ${sellerId} AND status = 'ACTIVE' AND title % ${title}
    ORDER BY sim DESC LIMIT 1`;
  const match = rows[0];
  return match && match.sim > 0.6 ? { id: match.id, title: match.title } : null;
}

// draftDescription (listing) now lives with the other editable-draft assists in
// the pure, client-safe module src/lib/skills.ts — one shared implementation for
// both the offline client path and the /api/suggestions/description wrapper.
export { draftDescription } from './skills';
