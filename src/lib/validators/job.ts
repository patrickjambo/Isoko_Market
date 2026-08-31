import { z } from 'zod';

// Canonical skill tokens from the shared taxonomy (src/lib/skills.ts).
const skillList = z.array(z.string().trim().min(1).max(48)).max(20).default([]);

export const createJobSchema = z
  .object({
    title: z.string().trim().min(3, 'Add a job title.').max(120),
    description: z.string().trim().min(10, 'Describe the role.').max(6000),
    type: z.enum(['JOB', 'GIG']).default('JOB'),
    payMin: z.coerce.number().int().min(0).max(1_000_000_000).optional().nullable(),
    payMax: z.coerce.number().int().min(0).max(1_000_000_000).optional().nullable(),
    payPeriod: z.enum(['hour', 'day', 'month', 'fixed']).default('month'),
    location: z.string().trim().min(2, 'Add a location.').max(80),
    // Optional extra contact so applicants can reach the employer directly:
    // phone / email / WhatsApp / Instagram, etc. Free-form on purpose.
    contactInfo: z.string().trim().max(200).optional(),
    // Required skills — drives match-quality scoring against seeker CVs (§5/§10).
    skills: skillList,
    // Optional: post under a partner's white-label board (Phase 5).
    partnerId: z.string().cuid().optional().nullable(),
  })
  .refine(
    (v) => v.payMin == null || v.payMax == null || v.payMax >= v.payMin,
    { message: 'Maximum pay must be at least the minimum.', path: ['payMax'] }
  );

export const jobFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  type: z.enum(['JOB', 'GIG']).optional(),
  location: z.string().trim().max(80).optional(),
  minPay: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const applyJobSchema = z.object({
  coverNote: z.string().trim().max(1000).optional(),
});

// Employer-settable statuses. POSITION_FILLED is system-only (job-filled cascade).
export const updateApplicationSchema = z.object({
  status: z.enum(['APPLIED', 'VIEWED', 'SHORTLISTED', 'INTERVIEW', 'REJECTED', 'HIRED']),
});

export const savedSearchSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  q: z.string().trim().max(120).optional(),
  type: z.enum(['JOB', 'GIG']).optional(),
  location: z.string().trim().max(80).optional(),
  skills: z.array(z.string().trim().min(1).max(48)).max(20).default([]),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type JobFilter = z.infer<typeof jobFilterSchema>;
export type SavedSearchInput = z.infer<typeof savedSearchSchema>;
