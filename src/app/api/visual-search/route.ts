import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/auth';
import { favoritedSet } from '@/lib/queries';
import { describeImageForSearch, visualSearchListings } from '@/lib/visual-search';
import { background } from '@/lib/background';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
// Generous timeout — Gemini vision call + DB queries can take up to 25s
export const maxDuration = 30;

const cardSelect = {
  id: true,
  title: true,
  price: true,
  discountPrice: true,
  discountEndsAt: true,
  location: true,
  status: true,
  isFeatured: true,
  kind: true,
  latitude: true,
  longitude: true,
  ratingAvg: true,
  ratingCount: true,
  images: { orderBy: { position: 'asc' as const }, take: 1, select: { url: true } },
  category: { select: { slug: true } },
  seller: { select: { fullName: true, isVerified: true, verificationStatus: true } },
} satisfies Prisma.ListingSelect;

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

/** Lazily index up to 3 un-labelled active cover images in the background. */
function warmCatalogImageIndex(): void {
  background(async () => {
    const pending = await prisma.listingImage.findMany({
      where: {
        aiDescription: null,
        position: 0,
        listing: { status: 'ACTIVE', seller: { accountStatus: 'ACTIVE' } },
      },
      select: { id: true, url: true },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });
    for (const img of pending) {
      const desc = await describeImageForSearch(img.url);
      if (desc) {
        await prisma.listingImage.update({
          where: { id: img.id },
          data: { aiDescription: desc.description, aiTags: desc.tags },
        });
      }
    }
  });
}

/**
 * POST /api/visual-search
 * Accepts multipart/form-data with field "image" (File).
 * Returns matching ACTIVE listings sorted by visual/semantic similarity.
 *
 * Rate-limited: 20 searches/hour per user (or IP for anonymous).
 */
export const POST = route(async (req: NextRequest) => {
  if (!env.GEMINI_API_KEY.trim() && !env.ANTHROPIC_API_KEY.trim()) {
    throw new ApiError(
      'BAD_REQUEST',
      'Visual search requires a Gemini API key. Add GEMINI_API_KEY in environment variables.',
    );
  }

  // Auth is optional for visual search — anonymous users may search freely.
  // Wrap in try/catch so a transient DB check never blocks search.
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    user = await getCurrentUser();
  } catch {
    /* treat as anonymous */
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  const limitKey = user ? `visual:${user.id}` : `visual:${clientIp}`;
  const limit = rateLimit(limitKey, 20, 60 * 60 * 1000);
  if (!limit.success) {
    throw new ApiError('RATE_LIMITED', 'Too many visual searches. Please wait a moment.');
  }

  const form = await req.formData();
  const file = form.get('image');
  if (!(file instanceof File)) throw new ApiError('BAD_REQUEST', 'Please provide an image file.');

  const isImage = file.type.startsWith('image/') || IMAGE_EXT_RE.test(file.name);
  if (!isImage) {
    throw new ApiError('BAD_REQUEST', 'Please upload an image file (JPEG, PNG, WebP).');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new ApiError('BAD_REQUEST', 'Image is too large. Maximum size is 8 MB.');
  }

  // Pass image bytes directly to Gemini — search query photos are never persisted
  const bytes = await file.arrayBuffer();
  const mimeType = file.type.startsWith('image/') ? file.type : 'image/jpeg';

  // Run visual search (Gemini vision -> keyword extraction -> DB match / nearest alternatives)
  const searchResult = await visualSearchListings({ bytes, mimeType });

  if (!searchResult.ok) {
    return NextResponse.json(
      { error: { code: 'AI_UNAVAILABLE', message: searchResult.errorMessage } },
      { status: 502 },
    );
  }

  // Keep existing catalog images warming in the background without delaying this response
  warmCatalogImageIndex();

  if (searchResult.listingIds.length === 0) {
    return jsonOk({
      items: [],
      total: 0,
      alternativesUsed: false,
      queryDescription: searchResult.queryDescription,
      queryTags: searchResult.queryTags,
      suggestedQuery: searchResult.suggestedQuery,
    });
  }

  // Fetch matched active listings (excluding suspended/banned sellers)
  const listings = await prisma.listing.findMany({
    where: {
      id: { in: searchResult.listingIds },
      status: 'ACTIVE',
      seller: { accountStatus: 'ACTIVE' },
    },
    select: cardSelect,
  });

  // Preserve visual similarity ranking order
  const rankMap = new Map(searchResult.listingIds.map((id, i) => [id, i]));
  const sorted = listings.sort((a, b) => (rankMap.get(a.id) ?? 99) - (rankMap.get(b.id) ?? 99));

  // Attach saved-heart state for signed-in users
  let favSet = new Set<string>();
  if (user && sorted.length > 0) {
    try {
      favSet = await favoritedSet(user.id, sorted.map((l) => l.id));
    } catch {
      /* non-fatal */
    }
  }
  const items = sorted.map((l) => ({ ...l, favorited: favSet.has(l.id) }));

  return jsonOk({
    items,
    total: items.length,
    alternativesUsed: searchResult.alternativesUsed,
    queryDescription: searchResult.queryDescription,
    queryTags: searchResult.queryTags,
    suggestedQuery: searchResult.suggestedQuery,
  });
});
