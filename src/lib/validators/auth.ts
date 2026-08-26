import { z } from 'zod';
import { isValidRwandaPhone } from '../phone';

export const phoneSchema = z
  .string()
  .trim()
  .refine(isValidRwandaPhone, { message: 'Enter a valid Rwandan phone number.' });

export const requestOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code.'),
  // Provided only on first-time registration.
  fullName: z.string().trim().min(2).max(80).optional(),
  role: z.enum(['BUYER', 'SELLER', 'EMPLOYER']).optional(),
  locale: z.enum(['rw', 'en', 'fr']).optional(),
  // Onboarding intent chosen on the "Get Started" fork (Visitor spec §3/§8).
  intent: z.enum(['buy_sell', 'find_work', 'hire', 'browse']).optional(),
  // Optional referral code captured from an invite link (?ref=CODE).
  ref: z.string().trim().max(16).optional(),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
