/**
 * Suggested feature labels per product category (by slug) — one-tap prompts in
 * the sell wizard so a phone gets RAM/Storage, a car gets Year/Mileage, etc. The
 * seller can always add their own custom rows too; these are just starters.
 */
export const SPEC_SUGGESTIONS: Record<string, string[]> = {
  phones: ['Brand', 'Model', 'Storage', 'RAM', 'Color', 'Battery'],
  electronics: ['Brand', 'Model', 'Processor', 'RAM', 'Storage', 'Screen size'],
  vehicles: ['Make', 'Model', 'Year', 'Mileage', 'Fuel', 'Transmission'],
  fashion: ['Brand', 'Size', 'Color', 'Material'],
  home: ['Material', 'Dimensions', 'Color'],
  agriculture: ['Type', 'Quantity', 'Unit'],
  food: ['Weight', 'Quantity', 'Expiry'],
};

/** Feature suggestions for a category slug, or a small generic default. */
export function specSuggestionsFor(slug?: string | null): string[] {
  if (slug && SPEC_SUGGESTIONS[slug]) return SPEC_SUGGESTIONS[slug]!;
  return ['Brand', 'Model', 'Color'];
}
