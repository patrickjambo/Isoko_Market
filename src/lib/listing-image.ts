/**
 * Cover-image resolution for listings. A listing with no uploaded photo falls
 * back to a category-representative image (committed under public/categories/)
 * so a card never renders as an empty/broken tile. Pure + shared by every card
 * and the detail gallery.
 */
const CATEGORY_SLUGS = [
  'phones',
  'electronics',
  'fashion',
  'home',
  'vehicles',
  'agriculture',
  'services',
  'food',
];

/** A category-representative fallback image (generic default if unknown). */
export function categoryFallbackImage(slug?: string | null): string {
  return `/categories/${slug && CATEGORY_SLUGS.includes(slug) ? slug : 'default'}.jpg`;
}

/** The listing's cover: its first uploaded photo, else the category fallback. */
export function listingCover(
  images: { url: string }[] | undefined,
  categorySlug?: string | null
): string {
  return images?.[0]?.url ?? categoryFallbackImage(categorySlug);
}
