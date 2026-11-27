import type { NextRequest } from 'next/server';
import { route, jsonOk, ApiError } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/auth';
import { visualSearchListings } from '@/lib/visual-search';
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

/**
 * POST /api/visual-search
 * Accepts multipart/form-data with field "image" (File).
 * Returns matching ACTIVE listings sorted by visual similarity.
 *
 * Rate-limited: 10 searches/hour per user (or IP for anonymous).
 * Requires GEMINI_API_KEY to be configured.
 */
export const POST = route(async (req: NextRequest) => {
  if (!env.GEMINI_API_KEY) {
    throw new ApiError(
      'BAD_REQUEST',
      'Visual search requires a Gemini API key. Add GEMINI_API_KEY to your Vercel environment variables (free at aistudio.google.com/app/apikey).',
    );
  }

  // Auth is optional for visual search — anonymous users may search freely.
  // Wrap in try/catch so a DB migration lag (e.g. missing column) never blocks search.
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try { user = await getCurrentUser(); } catch { /* treat as anonymous */ }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  const limitKey = user ? `visual:${user.id}` : `visual:${clientIp}`;
  const limit = rateLimit(limitKey, 10, 60 * 60 * 1000);
  if (!limit.success) {
    throw new ApiError('RATE_LIMITED', 'Too many visual searches. Please wait a moment.');
  }

  const form = await req.formData();
  const file = form.get('image');
  if (!(file instanceof File)) throw new ApiError('BAD_REQUEST', 'Please provide an image file.');
  if (!file.type.startsWith('image/'))
    throw new ApiError('BAD_REQUEST', 'Please upload an image file (JPEG, PNG, WebP).');
  if (file.size > 8 * 1024 * 1024)
    throw new ApiError('BAD_REQUEST', 'Image is too large. Maximum size is 8 MB.');

  // Pass image bytes directly to Gemini — no storage upload required for visual search
  const bytes = await file.arrayBuffer();
  const mimeType = file.type || 'image/jpeg';

  // Run visual search (Gemini vision → keyword extraction → DB search)
  const searchResult = await visualSearchListings({ bytes, mimeType });

  if (!searchResult || searchResult.listingIds.length === 0) {
    return jsonOk({
      items: [],
      total: 0,
      queryDescription: searchResult?.queryDescription ?? '',
      queryTags: searchResult?.queryTags ?? '',
    });
  }

  // Fetch matched listings in one query
  const listings = await prisma.listing.findMany({
    where: { id: { in: searchResult.listingIds }, status: 'ACTIVE' },
    select: cardSelect,
  });

  // Re-sort by relevance rank from visual search
  const rankMap = new Map(searchResult.listingIds.map((id, i) => [id, i]));
  const sorted = listings.sort((a, b) => (rankMap.get(a.id) ?? 99) - (rankMap.get(b.id) ?? 99));

  return jsonOk({
    items: sorted,
    total: sorted.length,
    queryDescription: searchResult.queryDescription,
    queryTags: searchResult.queryTags,
  });
});
