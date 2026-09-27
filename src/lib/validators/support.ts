import { z } from 'zod';

export const SUPPORT_CATEGORIES = [
  'PAYMENT',
  'ACCOUNT',
  'LISTING',
  'JOBS',
  'VERIFICATION',
  'OTHER',
] as const;

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, 'Enter a subject.').max(120),
  category: z.enum(SUPPORT_CATEGORIES).default('OTHER'),
  message: z.string().trim().min(5, 'Describe your issue.').max(4000),
});

export const replySchema = z.object({
  body: z.string().trim().min(1, 'Type a message.').max(4000),
});

export const ticketPatchSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
});
