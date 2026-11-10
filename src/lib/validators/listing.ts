import { z } from 'zod';
import { contactSchema } from '../contact';

export const listingConditions = [
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'FAIR',
  'FOR_PARTS',
] as const;

export const listingKinds = ['PRODUCT', 'SERVICE'] as const;

// A product feature row, e.g. { label: "RAM", value: "8GB" }.
export const listingSpecSchema = z.object({
  label: z.string().trim().min(1).max(40),
  value: z.string().trim().min(1).max(200),
});
export type ListingSpec = z.infer<typeof listingSpecSchema>;

const imagePathSchema = z.string().refine(
  (val) => val.startsWith('/') || /^https?:\/\//i.test(val),
  { message: 'Invalid image path or URL' }
);

export const createListingSchema = z.object({
  title: z.string().trim().min(3, 'Add a short, clear title.').max(120),
  description: z.string().trim().min(10, 'Describe the item.').max(4000),
  // Price entered in whole RWF (optional — empty, null, or 0 indicates open/negotiable/contact).
  // Automatically handles formatted input (e.g. "10,000", "10 000 RWF") and clamps to Postgres 32-bit int.
  price: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return 0;
      if (typeof val === 'string') {
        const cleaned = val.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : Math.round(num);
      }
      if (typeof val === 'number') {
        return isNaN(val) ? 0 : Math.round(val);
      }
      return 0;
    },
    z.coerce.number().min(0).max(100_000_000_000, 'Enter a valid price.').default(0)
  ),
  categoryId: z.string().cuid().optional().nullable(),
  // Optional (no default) so PUT edits that omit it leave the stored kind intact;
  // create routes fall back to PRODUCT.
  kind: z.enum(listingKinds).optional(),
  condition: z.enum(listingConditions).default('GOOD'),
  location: z.string().trim().min(2, 'Add a location.').max(80),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  images: z.array(imagePathSchema).max(6).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  // Structured product features (RAM, processor, year, …) shown to buyers.
  specs: z.array(listingSpecSchema).max(20).optional(),
  showPhone: z.boolean().default(false),
  // Structured, clickable contact channels (phone / WhatsApp / email / Instagram).
  contactInfo: contactSchema.optional(),
});

/** Partial draft — every field optional so autosave never blocks on a dropped step. */
export const draftDataSchema = z.object({
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(4000).optional(),
  price: z.preprocess(
    (val) => {
      if (val === '' || val === null || val === undefined) return null;
      if (typeof val === 'string') {
        const cleaned = val.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : Math.round(num);
      }
      if (typeof val === 'number') {
        return isNaN(val) ? null : Math.round(val);
      }
      return null;
    },
    z.coerce.number().min(0).max(100_000_000_000).optional().nullable()
  ),
  categoryId: z.string().cuid().optional().nullable(),
  kind: z.enum(listingKinds).optional(),
  condition: z.enum(listingConditions).optional(),
  specs: z.array(listingSpecSchema).max(20).optional(),
  location: z.string().trim().max(80).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  images: z.array(imagePathSchema).max(6).optional(),
  tags: z.array(z.string().trim().max(40)).max(10).optional(),
  showPhone: z.boolean().optional(),
});

export const listingFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  categoryId: z.string().optional(),
  kind: z.enum(listingKinds).optional(),
  // JSON array of [label, value] tuples — category-scoped spec facet filters.
  specs: z.string().max(1000).optional(),
  // Buyer's coordinates for "near me" (bounding-box proximity filter).
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
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
  kind: z.enum(listingKinds).optional(),
  condition: z.enum(listingConditions).optional(),
  location: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
export type ListingFilter = z.infer<typeof listingFilterSchema>;
export type ListingAlertInput = z.infer<typeof listingAlertSchema>;
