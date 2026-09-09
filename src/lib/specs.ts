/**
 * Feature-label suggestions for the sell wizard. Two layers, best first:
 *  1. AI suggests labels from the actual product title (see aiSuggestSpecs).
 *  2. This deterministic fallback infers them from keywords in the title, then
 *     from the category — so a phone gets RAM/Storage, a car Year/Mileage, rice
 *     Weight/Type, etc. The seller can always add custom rows too.
 */
export const SPEC_SUGGESTIONS: Record<string, string[]> = {
  phones: ['Brand', 'Model', 'Storage', 'RAM', 'Color', 'Battery'],
  electronics: ['Brand', 'Model', 'Processor', 'RAM', 'Storage', 'Screen size'],
  vehicles: ['Make', 'Model', 'Year', 'Mileage', 'Fuel', 'Transmission'],
  fashion: ['Brand', 'Size', 'Color', 'Material'],
  home: ['Material', 'Dimensions', 'Color'],
  agriculture: ['Type', 'Quantity', 'Unit'],
  food: ['Type', 'Weight', 'Quantity', 'Expiry'],
};

// Keyword → feature set. Matched against the product title so suggestions fit
// what the seller is actually selling, even before a category is chosen.
const KEYWORD_SPECS: { keywords: string[]; specs: string[] }[] = [
  {
    keywords: ['phone', 'iphone', 'samsung', 'galaxy', 'tecno', 'itel', 'infinix', 'redmi', 'smartphone', 'tablet', 'ipad'],
    specs: ['Brand', 'Model', 'Storage', 'RAM', 'Battery', 'Color'],
  },
  {
    keywords: ['laptop', 'computer', 'macbook', 'notebook', 'desktop', 'pc'],
    specs: ['Brand', 'Model', 'Processor', 'RAM', 'Storage', 'Screen size'],
  },
  {
    keywords: ['car', 'vehicle', 'toyota', 'corolla', 'rav4', 'hilux', 'truck', 'lorry', 'motorcycle', 'moto', 'motorbike', 'bike', 'bicycle'],
    specs: ['Make', 'Model', 'Year', 'Mileage', 'Fuel', 'Transmission'],
  },
  {
    keywords: ['tv', 'television', 'monitor', 'fridge', 'freezer', 'washing', 'microwave', 'speaker', 'radio', 'cooker', 'iron', 'blender'],
    specs: ['Brand', 'Model', 'Size', 'Power', 'Condition'],
  },
  {
    keywords: ['shoe', 'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'dress', 'shirt', 'trouser', 'trousers', 'jean', 'jeans', 'jacket', 'clothes', 'clothing', 'handbag', 'watch', 'suit', 'skirt'],
    specs: ['Brand', 'Size', 'Color', 'Material'],
  },
  {
    keywords: ['rice', 'beans', 'maize', 'flour', 'sugar', 'oil', 'food', 'fruit', 'vegetable', 'milk', 'meat', 'honey', 'coffee', 'tea'],
    specs: ['Type', 'Weight', 'Quantity', 'Expiry'],
  },
  {
    keywords: ['sofa', 'chair', 'table', 'bed', 'furniture', 'cupboard', 'wardrobe', 'mattress', 'shelf', 'desk'],
    specs: ['Material', 'Dimensions', 'Color', 'Condition'],
  },
  {
    keywords: ['cow', 'goat', 'chicken', 'pig', 'rabbit', 'livestock', 'animal', 'seed', 'fertilizer', 'crop', 'harvest'],
    specs: ['Type', 'Breed', 'Quantity', 'Age'],
  },
];

/** Infer features from keywords in the product title, or null if none match.
 *  Whole-word matching avoids false hits (e.g. "car" inside "scarf"). */
export function inferSpecsFromTitle(title: string): string[] | null {
  const words = new Set((title || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  if (words.size === 0) return null;
  for (const { keywords, specs } of KEYWORD_SPECS) {
    if (keywords.some((k) => words.has(k))) return specs;
  }
  return null;
}

/** Best deterministic suggestions: title keywords first, then category, then a
 *  small generic default. */
export function suggestSpecs(title: string, slug?: string | null): string[] {
  return (
    inferSpecsFromTitle(title) ?? (slug ? SPEC_SUGGESTIONS[slug] : undefined) ?? ['Brand', 'Model', 'Color']
  );
}

/** Feature suggestions for a category slug only (used where there's no title). */
export function specSuggestionsFor(slug?: string | null): string[] {
  return (slug && SPEC_SUGGESTIONS[slug]) || ['Brand', 'Model', 'Color'];
}
