import { z } from 'zod';
import { contactSchema } from '../contact';

export const listingConditions = [
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'FAIR',
  'FOR_PARTS',
] as const;

export const createListingSchema = z.object({
  title: z.string().trim().min(3, 'Add a short, clear title.').max(120),
  description: z.string().trim().min(10, 'Describe the item.').max(4000),
  // Price entered in whole RWF by the user; converted to minor units server-side.
  price: z.coerce.number().int('Enter a valid price.').min(0).max(1_000_000_000),
  categoryId: z.string().cuid().optional().nullable(),
  condition: z.enum(listingConditions).default('GOOD'),
  location: z.string().trim().min(2, 'Add a location.').max(80),
  images: z.array(z.string().url()).max(6).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  showPhone: z.boolean().default(false),
  // Structured, clickable contact channels (phone / WhatsApp / email / Instagram).
  contactInfo: contactSchema.optional(),
});

/** Partial draft — every field optional so autosave never blocks on a dropped step. */
export const draftDataSchema = z.object({
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(4000).optional(),
  price: z.coerce.number().int().min(0).max(1_000_000_000).optional().nullable(),
  categoryId: z.string().cuid().optional().nullable(),
  condition: z.enum(listingConditions).optional(),
  location: z.string().trim().max(80).optional(),
  images: z.array(z.string().url()).max(6).optional(),
  tags: z.array(z.string().trim().max(40)).max(10).optional(),
  showPhone: z.boolean().optional(),
});

export const listingFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  categoryId: z.string().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  location: z.string().trim().max(80).optional(),
  condition: z.enum(listingConditions).optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
});

/** A marketplace "notify me" alert — the buyer-side twin of savedSearchSchema. */
export const listingAlertSchema = z.object({
  label: z.string().trim().max(80).optional(),
  q: z.string().trim().max(120).optional(),
  categoryId: z.string().optional(),
  condition: z.enum(listingConditions).optional(),
  location: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type ListingFilter = z.infer<typeof listingFilterSchema>;
export type ListingAlertInput = z.infer<typeof listingAlertSchema>;
