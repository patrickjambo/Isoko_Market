import 'server-only';
import { prisma } from './prisma';
import { notify } from './notifications';

const DAY = 24 * 60 * 60 * 1000;
const NUDGE_AFTER_DAYS = 30; // prompt "still available?"
const ARCHIVE_AFTER_NUDGE_DAYS = 15; // auto-pause if no response

/**
 * Keep the marketplace fresh (Section 5). Runs periodically (via /api/cron/sweep):
 *  - listings active > 30 days and not yet nudged → send a "still available?"
 *    nudge and stamp staleNudgedAt.
 *  - listings nudged > 15 days ago with no update since → auto-pause + notify.
 * Ties back to the admin data-quality goals.
 */
export async function sweepStaleListings() {
  const now = Date.now();
  const nudgeCutoff = new Date(now - NUDGE_AFTER_DAYS * DAY);
  const archiveCutoff = new Date(now - ARCHIVE_AFTER_NUDGE_DAYS * DAY);

  // 1) Nudge stale-but-un-nudged listings.
  const toNudge = await prisma.listing.findMany({
    where: { status: 'ACTIVE', staleNudgedAt: null, createdAt: { lt: nudgeCutoff } },
    select: { id: true, sellerId: true, title: true },
    take: 500,
  });
  for (const l of toNudge) {
    await prisma.listing.update({ where: { id: l.id }, data: { staleNudgedAt: new Date() } });
    await notify({
      userId: l.sellerId,
      type: 'SYSTEM',
      title: 'Is this still available?',
      body: `"${l.title}" has been listed for a while. Update it, or it will be paused soon.`,
      href: `/dashboard/listings`,
      payload: { listingId: l.id },
    });
  }

  // 2) Auto-pause listings nudged long ago with no seller action.
  const toArchive = await prisma.listing.findMany({
    where: { status: 'ACTIVE', staleNudgedAt: { lt: archiveCutoff } },
    select: { id: true, sellerId: true, title: true },
    take: 500,
  });
  for (const l of toArchive) {
    await prisma.listing.update({ where: { id: l.id }, data: { status: 'PAUSED' } });
    await notify({
      userId: l.sellerId,
      type: 'SYSTEM',
      title: 'Listing paused',
      body: `"${l.title}" was paused to keep the market fresh. Relist it anytime.`,
      href: `/dashboard/listings`,
      payload: { listingId: l.id },
    });
  }

  return { nudged: toNudge.length, archived: toArchive.length };
}
