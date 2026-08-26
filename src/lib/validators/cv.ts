import { z } from 'zod';

export const EDUCATION_LEVELS = ['primary', 'secondary', 'tvet', 'bachelor', 'masters', 'phd'] as const;
export const DEGREE_CLASSES = ['FIRST_CLASS', 'UPPER_SECOND', 'LOWER_SECOND', 'PASS', 'ORDINARY'] as const;
export const LANGUAGE_LEVELS = ['basic', 'conversational', 'fluent', 'native'] as const;

/**
 * A structured education entry (CV Builder spec Part 4). Reference selections are
 * stored as BOTH the seeded id AND the resolved human label, so the immutable
 * per-application CV snapshot renders correctly without ever joining the
 * reference tables. `*NameRaw` is only set via the explicit "add new" fallback.
 * Legacy `school`/`qualification` are tolerated so pre-existing CVs still parse.
 */
export const educationSchema = z.object({
  level: z.enum(EDUCATION_LEVELS).optional().default('secondary'),
  institutionId: z.string().max(40).optional().default(''),
  institutionName: z.string().trim().max(160).optional().default(''),
  facultyId: z.string().max(40).optional().default(''),
  facultyName: z.string().trim().max(160).optional().default(''),
  combinationId: z.string().max(40).optional().default(''),
  combinationName: z.string().trim().max(160).optional().default(''),
  degreeClassification: z.enum(DEGREE_CLASSES).optional().nullable(),
  startYear: z.string().trim().max(9).optional().default(''),
  endYear: z.string().trim().max(9).optional().default(''),
  certificateUrl: z.string().trim().max(500).optional().default(''),
  // legacy (old flat entries) — kept for display back-compat.
  school: z.string().trim().max(160).optional(),
  qualification: z.string().trim().max(160).optional(),
});

export const experienceSchema = z.object({
  company: z.string().trim().min(1).max(120),
  position: z.string().trim().max(120).optional().default(''),
  startYear: z.string().trim().max(9).optional().default(''),
  endYear: z.string().trim().max(9).optional().default(''),
  summary: z.string().trim().max(600).optional().default(''),
});

// { code: 'rw'|'en'|'fr'|…, level?: basic|conversational|fluent|native }.
// Legacy string entries (e.g. "English") are normalized to { code }.
export const languageEntrySchema = z.object({
  code: z.string().trim().min(1).max(24),
  level: z.enum(LANGUAGE_LEVELS).optional(),
});

// Professional-CV fields that a real CV needs (added per request): a compact
// contact block, common Rwanda-CV personal details, certifications and referees.
export const certificationSchema = z.object({
  name: z.string().trim().max(160),
  issuer: z.string().trim().max(120).optional().default(''),
  year: z.string().trim().max(9).optional().default(''),
  url: z.string().trim().max(500).optional().default(''),
});

export const referenceSchema = z.object({
  name: z.string().trim().max(120),
  relationship: z.string().trim().max(80).optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
  email: z.string().trim().max(120).optional().default(''),
});

export const cvDataSchema = z.object({
  headline: z.string().trim().max(120).optional().default(''),
  summary: z.string().trim().max(1200).optional().default(''),
  // Contact & personal.
  contactEmail: z.string().trim().max(120).optional().default(''),
  portfolioUrl: z.string().trim().max(200).optional().default(''),
  dateOfBirth: z.string().trim().max(20).optional().default(''),
  nationality: z.string().trim().max(60).optional().default(''),
  gender: z.string().trim().max(20).optional().default(''),
  drivingLicense: z.string().trim().max(40).optional().default(''),
  education: z.array(educationSchema).max(10).default([]),
  experience: z.array(experienceSchema).max(10).default([]),
  // Canonical skill tokens from the shared taxonomy (src/lib/skills.ts).
  skills: z.array(z.string().trim().min(1).max(48)).max(30).default([]),
  skillLevels: z.record(z.enum(['beginner', 'experienced', 'expert'])).optional().default({}),
  languages: z
    .preprocess(
      (v) =>
        Array.isArray(v)
          ? v.map((x) => (typeof x === 'string' ? { code: x } : x))
          : [],
      z.array(languageEntrySchema).max(10)
    )
    .default([]),
  certifications: z.array(certificationSchema).max(20).default([]),
  references: z.array(referenceSchema).max(5).default([]),
  // Most-specific selected division { id, label: "Province › … › Cell" }. The id
  // is mirrored to the queryable CV.locationId column on save; the label is kept
  // for snapshot/PDF rendering without a DB walk.
  location: z
    .object({ id: z.string().max(40), label: z.string().max(200) })
    .nullable()
    .optional()
    .default(null),
});

export type CvData = z.infer<typeof cvDataSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type LanguageEntry = z.infer<typeof languageEntrySchema>;
export type Certification = z.infer<typeof certificationSchema>;
export type Reference = z.infer<typeof referenceSchema>;
