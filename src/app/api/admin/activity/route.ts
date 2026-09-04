import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';

type ActivityItem = { id: string; name: string; label: string; at: string };

/**
 * GET /api/admin/activity — the last ~12 platform events reconstructed from real
 * tables (signups, listings, jobs, payments, reports). The activity ticker polls
 * this so it stays populated even on a multi-instance host, where the ephemeral
 * admin SSE bus (emitAdmin) can't reach the viewer. `id` is deterministic so the
 * client can de-dupe across poll + SSE.
 */
export const GET = adminRoute(null, async () => {
  const [users, listings, jobs, txns, reports] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, fullName: true, createdAt: true } }),
    prisma.listing.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, title: true, createdAt: true } }),
    prisma.job.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, title: true, createdAt: true } }),
    prisma.transaction.findMany({ where: { status: 'SUCCESS' }, orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, amount: true, createdAt: true } }),
    prisma.report.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { id: true, targetType: true, createdAt: true } }),
  ]);

  const items: ActivityItem[] = [
    ...users.map((u) => ({ id: `u:${u.id}`, name: 'signup', label: `New user: ${u.fullName}`, at: u.createdAt.toISOString() })),
    ...listings.map((l) => ({ id: `l:${l.id}`, name: 'listing.created', label: `New listing: ${l.title}`, at: l.createdAt.toISOString() })),
    ...jobs.map((j) => ({ id: `j:${j.id}`, name: 'job.created', label: `New job: ${j.title}`, at: j.createdAt.toISOString() })),
    ...txns.map((tx) => ({ id: `t:${tx.id}`, name: 'transaction.completed', label: `Payment: ${(tx.amount / 100).toLocaleString()} RWF`, at: tx.createdAt.toISOString() })),
    ...reports.map((r) => ({ id: `r:${r.id}`, name: 'report.created', label: `New report (${r.targetType.toLowerCase()})`, at: r.createdAt.toISOString() })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);

  return { data: { items } };
});
