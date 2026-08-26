import { adminRoute } from '@/lib/admin-route';
import { ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

/**
 * Platform analytics — the business-plan KPIs (users reached, transactions,
 * MSME partners, verified %, rural users). `?format=csv` streams a CSV export
 * (guarded by analytics.export).
 */
async function computeKpis() {
  const rural = ['Musanze', 'Huye', 'Rubavu', 'Nyagatare', 'Rusizi', 'Karongi'];
  const [users, verified, transactions, revenue, partners, msme, jobs, filled, listings, ruralUsers] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isVerified: true } }),
      prisma.transaction.count({ where: { status: 'SUCCESS' } }),
      prisma.transaction.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
      prisma.partner.count(),
      prisma.partner.count({ where: { type: { in: ['MSME', 'COOPERATIVE'] } } }),
      prisma.job.count(),
      prisma.application.count({ where: { status: 'HIRED' } }),
      prisma.listing.count(),
      prisma.user.count({ where: { OR: rural.map((r) => ({ location: { contains: r, mode: 'insensitive' } })) } }),
    ]);

  return {
    users,
    verifiedPct: users ? Math.round((verified / users) * 100) : 0,
    transactions,
    revenueRwf: Math.round((revenue._sum.amount ?? 0) / 100),
    partners,
    msmePartners: msme,
    jobs,
    jobsFilled: filled,
    listings,
    ruralPct: users ? Math.round((ruralUsers / users) * 100) : 0,
  };
}

export const GET = adminRoute('analytics.view', async (req, _ctx, { admin, permissions }) => {
  const url = new URL(req.url);
  const kpis = await computeKpis();

  if (url.searchParams.get('format') === 'csv') {
    if (!permissions.has('analytics.export')) {
      throw new ApiError('FORBIDDEN', 'Missing permission: analytics.export');
    }
    await audit({ actorId: admin.id, action: 'analytics.export', targetType: 'ANALYTICS' });

    const rows = Object.entries(kpis).map(([k, v]) => `${k},${v}`).join('\n');
    const csv = `metric,value\n${rows}\n`;
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="isoko-kpis-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return { data: { kpis } };
});
