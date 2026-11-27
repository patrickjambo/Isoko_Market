/**
 * Discount helpers — shared between server and client.
 * Never import server-only modules here (no prisma, no env).
 */

/** Returns true if the listing has an active discount right now. */
export function isDiscountActive(listing: {
  discountPrice?: number | null;
  discountEndsAt?: string | Date | null;
}): boolean {
  if (!listing.discountPrice || listing.discountPrice <= 0) return false;
  if (!listing.discountEndsAt) return true; // permanent until explicitly cleared
  return new Date(listing.discountEndsAt) > new Date();
}

/** Returns the effective selling price (discount if active, else regular). */
export function effectivePrice(listing: {
  price: number;
  discountPrice?: number | null;
  discountEndsAt?: string | Date | null;
}): number {
  return isDiscountActive(listing) && listing.discountPrice
    ? listing.discountPrice
    : listing.price;
}

/** Percentage saved, rounded to nearest integer. */
export function discountPercent(regular: number, sale: number): number {
  if (regular <= 0) return 0;
  return Math.round(((regular - sale) / regular) * 100);
}
