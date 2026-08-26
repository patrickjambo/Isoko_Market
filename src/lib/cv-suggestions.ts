import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * CV reference-data autocomplete (spec Part 3) — the SAME shared suggestion
 * pattern used for listing titles / CV skills (Rule 3), just querying the seeded
 * reference tables. Trilingual `name` JSON is searched across rw/en/fr so a query
 * in any language matches.
 */

type Loc = 'rw' | 'en' | 'fr';
const loc = (l: string): Loc => (l === 'rw' || l === 'fr' ? l : 'en');
const pick = (name: unknown, l: Loc): string => {
  const n = (name ?? {}) as Record<string, string>;
  return n[l] ?? n.en ?? Object.values(n)[0] ?? '';
};

export type InstitutionSuggestion = { id: string; name: string; verified: boolean };

/** Institutions by name, filtered to the level's type (secondary_school|university|tvet). */
export async function suggestInstitutions(q: string, type: string): Promise<InstitutionSuggestion[]> {
  const rows = await prisma.institution.findMany({
    where: {
      type,
      ...(q.trim() ? { name: { contains: q.trim(), mode: 'insensitive' } } : {}),
    },
    orderBy: [{ isVerifiedSource: 'desc' }, { name: 'asc' }],
    take: 8,
    select: { id: true, name: true, isVerifiedSource: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, verified: r.isVerifiedSource }));
}

/** Create a user-submitted institution (add-new fallback) for admin review. */
export async function addInstitution(name: string, type: string): Promise<InstitutionSuggestion> {
  const inst = await prisma.institution.create({
    data: { name: name.trim().slice(0, 160), type, isVerifiedSource: false },
    select: { id: true, name: true, isVerifiedSource: true },
  });
  return { id: inst.id, name: inst.name, verified: inst.isVerifiedSource };
}

export type CombinationSuggestion = { id: string; code: string; label: string };

/** A-level combinations / TVET trades — search by code or trilingual name. */
export async function suggestCombinations(q: string, kind: string | undefined, locale: string): Promise<CombinationSuggestion[]> {
  const l = loc(locale);
  const query = q.trim();
  const like = `%${query}%`;
  const kindClause = kind ? Prisma.sql`AND kind = ${kind}` : Prisma.empty;
  const rows = query
    ? await prisma.$queryRaw<{ id: string; code: string; name: unknown }[]>`
        SELECT id, code, name FROM "Combination"
        WHERE (code ILIKE ${like}
           OR name->>'en' ILIKE ${like} OR name->>'rw' ILIKE ${like} OR name->>'fr' ILIKE ${like})
          ${kindClause}
        ORDER BY code ASC LIMIT 12`
    : await prisma.$queryRaw<{ id: string; code: string; name: unknown }[]>`
        SELECT id, code, name FROM "Combination" WHERE TRUE ${kindClause} ORDER BY code ASC LIMIT 12`;
  return rows.map((r) => ({ id: r.id, code: r.code, label: `${r.code} — ${pick(r.name, l)}` }));
}

export type FacultySuggestion = { id: string; label: string };

/** Faculties of a specific university (cascading — empty until a university is chosen). */
export async function suggestFaculties(universityId: string, q: string, locale: string): Promise<FacultySuggestion[]> {
  if (!universityId) return [];
  const l = loc(locale);
  const query = q.trim();
  const like = `%${query}%`;
  const rows = query
    ? await prisma.$queryRaw<{ id: string; name: unknown }[]>`
        SELECT id, name FROM "Faculty"
        WHERE "institutionId" = ${universityId}
          AND (name->>'en' ILIKE ${like} OR name->>'rw' ILIKE ${like} OR name->>'fr' ILIKE ${like})
        LIMIT 12`
    : await prisma.$queryRaw<{ id: string; name: unknown }[]>`
        SELECT id, name FROM "Faculty" WHERE "institutionId" = ${universityId} LIMIT 20`;
  return rows.map((r) => ({ id: r.id, label: pick(r.name, l) }));
}

export type LocationSuggestion = { id: string; name: string; level: string };

/** Cascading location autocomplete: divisions at `level` under `parentId`. */
export async function suggestLocations(q: string, level: string, parentId?: string): Promise<LocationSuggestion[]> {
  const rows = await prisma.adminDivision.findMany({
    where: {
      level,
      ...(parentId ? { parentId } : {}),
      ...(q.trim() ? { name: { contains: q.trim(), mode: 'insensitive' } } : {}),
    },
    orderBy: { name: 'asc' },
    take: 12,
    select: { id: true, name: true, level: true },
  });
  return rows;
}

/** Walk parentId up to the province so the full path can be shown/labelled. */
export async function locationPath(id: string): Promise<{ id: string; name: string; level: string }[]> {
  const path: { id: string; name: string; level: string }[] = [];
  let current: string | null = id;
  for (let i = 0; i < 6; i++) {
    if (!current) break;
    const cur: string = current;
    const node = await prisma.adminDivision.findUnique({
      where: { id: cur },
      select: { id: true, name: true, level: true, parentId: true },
    });
    if (!node) break;
    path.unshift({ id: node.id, name: node.name, level: node.level });
    current = node.parentId;
  }
  return path;
}
