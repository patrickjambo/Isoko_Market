import { describe, it, expect } from 'vitest';
import { formatEducation, sortEducation, formatLanguages, type EduLabels } from '@/lib/cv-format';
import { educationSchema, type Education, type LanguageEntry } from '@/lib/validators/cv';

// Simple, deterministic label resolvers so assertions read on structure, not i18n.
const eduLabels: EduLabels = {
  level: (lvl) =>
    ({ secondary: 'Secondary', tvet: 'TVET', bachelor: "Bachelor's", masters: "Master's", phd: 'PhD' }[lvl] ?? lvl),
  degree: (cls) => ({ FIRST_CLASS: 'First Class', UPPER_SECOND: 'Upper Second', PASS: 'Pass' }[cls] ?? cls),
  inWord: 'in',
  present: 'Present',
};

const langLabels = {
  lang: (code: string) => ({ en: 'English', rw: 'Kinyarwanda', fr: 'French' }[code] ?? code),
  level: (lvl: string) => ({ basic: 'Basic', fluent: 'Fluent', native: 'Native' }[lvl] ?? lvl),
};

// Build a fully-defaulted Education from a partial, like the app does on save.
const edu = (partial: Partial<Record<string, unknown>>): Education => educationSchema.parse(partial);

describe('formatEducation', () => {
  it('formats a university degree with faculty, institution, years and classification', () => {
    const f = formatEducation(
      edu({
        level: 'bachelor',
        facultyName: 'Computer Science',
        institutionName: 'University of Rwanda',
        degreeClassification: 'UPPER_SECOND',
        startYear: '2018',
        endYear: '2022',
      }),
      eduLabels
    );
    expect(f).toEqual({
      title: "Bachelor's in Computer Science",
      institution: 'University of Rwanda',
      years: '2018 – 2022',
      classification: 'Upper Second',
    });
  });

  it('falls back through facultyName → combinationName → qualification for the specialization', () => {
    // combination wins when no faculty
    expect(formatEducation(edu({ level: 'secondary', combinationName: 'MPC' }), eduLabels).title).toBe(
      'Secondary in MPC'
    );
    // legacy qualification is the last resort
    expect(formatEducation(edu({ level: 'tvet', qualification: 'Plumbing' }), eduLabels).title).toBe(
      'TVET in Plumbing'
    );
    // faculty takes precedence over a combination if both are present
    expect(
      formatEducation(edu({ level: 'bachelor', facultyName: 'Law', combinationName: 'MCB' }), eduLabels).title
    ).toBe("Bachelor's in Law");
  });

  it('uses the legacy school field when no reference institution is set', () => {
    const f = formatEducation(edu({ level: 'secondary', school: 'Green Hills Academy' }), eduLabels);
    expect(f.institution).toBe('Green Hills Academy');
  });

  it('omits the specialization and classification when absent, and marks ongoing study as Present', () => {
    const f = formatEducation(edu({ level: 'masters', institutionName: 'AIMS', startYear: '2023' }), eduLabels);
    expect(f.title).toBe("Master's"); // no "in ..."
    expect(f.years).toBe('2023 – Present'); // start with no end → Present
    expect(f.classification).toBe('');
  });

  it('yields an empty period string when no years are given', () => {
    expect(formatEducation(edu({ level: 'bachelor' }), eduLabels).years).toBe('');
  });
});

describe('sortEducation', () => {
  it('orders entries most-recent-first by end year (falling back to start year) without mutating the input', () => {
    const input = [
      edu({ institutionName: 'A', startYear: '2013', endYear: '2017' }),
      edu({ institutionName: 'B', startYear: '2018', endYear: '2022' }),
      edu({ institutionName: 'C', startYear: '2019', endYear: '' }), // ongoing → sorts by start year
    ];
    const sorted = sortEducation(input);
    expect(sorted.map((e) => e.institutionName)).toEqual(['B', 'C', 'A']);
    // original array is left untouched
    expect(input.map((e) => e.institutionName)).toEqual(['A', 'B', 'C']);
  });
});

describe('formatLanguages', () => {
  it('joins languages with their level, and drops the level when unset', () => {
    const langs: LanguageEntry[] = [
      { code: 'en', level: 'fluent' },
      { code: 'rw', level: 'native' },
      { code: 'fr' },
    ];
    expect(formatLanguages(langs, langLabels)).toBe('English (Fluent) · Kinyarwanda (Native) · French');
  });

  it('returns an empty string for no languages', () => {
    expect(formatLanguages([], langLabels)).toBe('');
  });
});
