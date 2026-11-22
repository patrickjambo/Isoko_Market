import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { describeImageForSearch } from '@/lib/visual-search';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/index-listing-images
 * Processes up to 20 listing images per run that have no AI description yet.
 * Protected by CRON_SECRET. Configure as a Vercel Cron Job:
 *   "0 * * * *" (every hour) in vercel.json.
 */
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!env.GEMINI_API_KEY) {
    return NextResponse.json({ skipped: true, reason: 'GEMINI_API_KEY not configured' });
  }

  // Find images from ACTIVE listings that haven't been indexed yet
  const images = await prisma.listingImage.findMany({
    where: {
      aiDescription: null,
      position: 0, // only cover images for efficiency
      listing: { status: 'ACTIVE' },
    },
    select: { id: true, url: true },
    take: 20,
    orderBy: { createdAt: 'asc' },
  });

  let indexed = 0;
  let failed = 0;

  for (const img of images) {
    try {
      const result = await describeImageForSearch(img.url);
      if (result) {
        await prisma.listingImage.update({
          where: { id: img.id },
          data: { aiDescription: result.description, aiTags: result.tags },
        });
        indexed++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ indexed, failed, total: images.length });
}
