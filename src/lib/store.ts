/**
 * A seller's public storefront name: their business/company name when set,
 * otherwise their personal name. Used on the store page, seller cards, and search.
 * Pure + dependency-free so it works on both server and client.
 */
export function storeName(u: { businessName?: string | null; fullName: string }): string {
  return u.businessName?.trim() || u.fullName;
}
