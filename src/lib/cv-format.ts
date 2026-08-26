import type { Education, LanguageEntry } from '@/lib/validators/cv';

/**
 * Pure, professional CV formatting (spec Part 9) — shared by the live preview
 * and the PDF export so they never drift. Label resolvers are injected so the
 * caller supplies its own (client `useTranslations` or server `getTranslations`).
 */
export type EduLabels = {
  level: (level: string) => string;
  degree: (cls: string) => string;
  inWord: string; // "in" / "muri" / "en"
  present: string; // "Present"
};

export type FormattedEducation = {
  /** e.g. "Bachelor's in Computer Science" or "Secondary — MPC …" */
  title: string;
  institution: string;
  years: string;
  classification: string;
};

export function formatEducation(entry: Education, l: EduLabels): FormattedEducation {
  const levelLabel = l.level(entry.level ?? 'secondary');
  const specialization =
    entry.facultyName?.trim() || entry.combinationName?.trim() || entry.qualification?.trim() || '';
  const institution = entry.institutionName?.trim() || entry.school?.trim() || '';
  const years = [entry.startYear, entry.endYear || (entry.startYear ? l.present : '')].filter(Boolean).join(' – ');
  const classification = entry.degreeClassification ? l.degree(entry.degreeClassification) : '';
  const title = specialization ? `${levelLabel} ${l.inWord} ${specialization}` : levelLabel;
  return { title, institution, years, classification };
}

/** Sort education most-recent-first (by end year, then start year). */
export function sortEducation(entries: Education[]): Education[] {
  const y = (e: Education) => Number(e.endYear || e.startYear || 0);
  return [...entries].sort((a, b) => y(b) - y(a));
}

export function formatLanguages(
  langs: LanguageEntry[],
  labels: { lang: (code: string) => string; level: (level: string) => string }
): string {
  return langs
    .map((l) => (l.level ? `${labels.lang(l.code)} (${labels.level(l.level)})` : labels.lang(l.code)))
    .join(' · ');
}
