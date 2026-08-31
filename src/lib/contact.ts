import { z } from 'zod';
import { normalizeRwandaPhone } from './phone';

/**
 * Structured, clickable contact channels a poster can add to a listing or job.
 * Every field is optional — the poster fills only what they use. Stored as JSON
 * on Listing.contactInfo / Job.contactInfo and rendered as tap-to-contact links.
 */
export type ContactChannels = {
  phone?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
};

/** Loose validation — never block a post over contact formatting; we clean it. */
export const contactSchema = z
  .object({
    phone: z.string().trim().max(30),
    whatsapp: z.string().trim().max(30),
    email: z.string().trim().max(160),
    instagram: z.string().trim().max(60),
  })
  .partial();

/** Drop empty channels; return null when nothing was provided (store null, not {}). */
export function cleanContact(input?: ContactChannels | null): ContactChannels | null {
  if (!input) return null;
  const out: ContactChannels = {};
  if (input.phone?.trim()) out.phone = input.phone.trim();
  if (input.whatsapp?.trim()) out.whatsapp = input.whatsapp.trim();
  if (input.email?.trim()) out.email = input.email.trim().toLowerCase();
  if (input.instagram?.trim()) out.instagram = input.instagram.trim().replace(/^@+/, '');
  return Object.keys(out).length ? out : null;
}

/** Read a Prisma JSON value back into the typed shape (or null). */
export function asContact(value: unknown): ContactChannels | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  return cleanContact({
    phone: typeof v.phone === 'string' ? v.phone : undefined,
    whatsapp: typeof v.whatsapp === 'string' ? v.whatsapp : undefined,
    email: typeof v.email === 'string' ? v.email : undefined,
    instagram: typeof v.instagram === 'string' ? v.instagram : undefined,
  });
}

/** `tel:` target — keep leading + and digits only. */
export function telLink(raw: string): string {
  return `tel:${raw.replace(/[^\d+]/g, '')}`;
}

/** wa.me wants the international number with NO leading +; normalize RW numbers. */
export function whatsappLink(raw: string): string {
  const rw = normalizeRwandaPhone(raw); // "+2507…" or null
  const intl = rw ? rw.replace('+', '') : raw.replace(/\D/g, '');
  return `https://wa.me/${intl}`;
}

/** Instagram profile URL from a handle (with or without @) or a pasted URL. */
export function instagramLink(raw: string): string {
  const handle = raw.trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/+$/, '');
  return `https://instagram.com/${handle}`;
}
