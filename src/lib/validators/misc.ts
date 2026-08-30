import { z } from 'zod';
import { isValidRwandaPhone } from '../phone';

export const sendMessageSchema = z.object({
  conversationId: z.string().cuid().optional(),
  // To start a new conversation from a listing/job:
  listingId: z.string().cuid().optional(),
  jobId: z.string().cuid().optional(),
  recipientId: z.string().cuid().optional(),
  body: z.string().trim().min(1, 'Write a message.').max(2000),
});

export const reportSchema = z.object({
  targetType: z.enum(['LISTING', 'JOB', 'USER', 'MESSAGE']),
  targetId: z.string().cuid(),
  reason: z.string().trim().min(1).max(120),
  details: z.string().trim().max(1000).optional(),
});

export const reviewSchema = z.object({
  revieweeId: z.string().cuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
  transactionId: z.string().cuid().optional(),
});

export const paymentSchema = z.object({
  type: z.enum(['SUBSCRIPTION', 'FEATURED_LISTING', 'JOB_POST', 'TOPUP']),
  // Amount in whole RWF; converted to minor units server-side.
  amount: z.coerce.number().int().min(100).max(10_000_000),
  provider: z.enum(['mtn_momo', 'airtel_money', 'mock']).default('mock'),
  reference: z.string().trim().max(120).optional(),
  metadata: z.record(z.string()).optional(),
});

export const verificationSubmitSchema = z.object({
  idDocumentUrl: z.string().url('Upload your ID first.'),
});

export const partnerSchema = z.object({
  name: z.string().trim().min(2, 'Add a partner name.').max(120),
  type: z.enum(['COOPERATIVE', 'NGO', 'MSME', 'GOVERNMENT']).default('MSME'),
  status: z.enum(['ACTIVE', 'PROSPECT', 'INACTIVE']).default('ACTIVE'),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  location: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
  tagline: z.string().trim().max(160).optional(),
  brandColor: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{6})$/, 'Use a hex colour like #0F766E.')
    .optional()
    .or(z.literal('')),
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(500).optional(),
  location: z.string().trim().max(80).optional(),
  locale: z.enum(['rw', 'en', 'fr']).optional(),
  avatarUrl: z.string().url().optional(),
  // Seller payout details for the manual peer-to-peer payment flow.
  paymentNumber: z
    .string()
    .trim()
    .refine(isValidRwandaPhone, { message: 'Enter a valid Rwandan phone number.' })
    .optional(),
  paymentProvider: z.enum(['mtn_momo', 'airtel_money']).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
