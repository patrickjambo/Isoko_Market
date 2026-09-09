import { z } from 'zod';

/** Seeker requests a service — must agree to the terms to proceed. */
export const createServiceRequestSchema = z.object({
  listingId: z.string().cuid(),
  note: z.string().trim().max(1000).optional(),
  agreedTerms: z.literal(true, {
    errorMap: () => ({ message: 'Please agree to the terms & conditions to continue.' }),
  }),
});

/** Status transitions — the API authorizer decides who may set which. */
export const updateServiceRequestSchema = z.object({
  status: z.enum(['CONFIRMED', 'DECLINED', 'COMPLETED', 'CANCELLED']),
});

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;
