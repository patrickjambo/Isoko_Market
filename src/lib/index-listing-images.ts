import 'server-only';
import { prisma } from './prisma';
import { describeImageForSearch } from './visual-search';
import { background } from './background';

/**
 * Queue AI description generation for all un-indexed images of a listing.
 * Called after listing creation or image update. Runs in background so it
 * never blocks the HTTP response.
 *
 * Uses Gemini vision to generate aiDescription + aiTags for each image,
 * which then powers the visual search feature.
 */
export function queueListingImageIndexing(listingId: string): void {
  background(async () => {
    const images = await prisma.listingImage.findMany({
      where: { listingId, aiDescription: null },
      select: { id: true, url: true },
      take: 5,
    });

    for (const img of images) {
      try {
        const result = await describeImageForSearch(img.url);
        if (result) {
          await prisma.listingImage.update({
            where: { id: img.id },
            data: {
              aiDescription: result.description,
              aiTags: result.tags,
            },
          });
        }
      } catch {
        // best-effort — will retry if listing is updated or cron runs
      }
    }
  });
}
