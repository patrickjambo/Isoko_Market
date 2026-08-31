import { z } from 'zod';
import { isValidRwandaPhone } from '../phone';

/** Rwandan phone — no longer used for auth; kept for the optional contact field
 *  and the seller's MoMo/Airtel payout number. */
export const phoneSchema = z
  .string()
  .trim()
  .refine(isValidRwandaPhone, { message: 'Enter a valid Rwandan phone number.' });

/** Email is the authentication channel (OTP is delivered here). */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(160);

// `login` only authenticates an EXISTING account; `register` is the only path
// that creates one (with a goal + name). Defaults to register for back-compat.
const authModeSchema = z.enum(['login', 'register']).optional().default('register');

export const requestOtpSchema = z.object({
  email: emailSchema,
  mode: authModeSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code.'),
  mode: authModeSchema,
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
