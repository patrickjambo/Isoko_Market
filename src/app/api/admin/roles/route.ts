import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';

/** GET /api/admin/roles — list of platform staff (admins/moderators). */
export const GET = adminRoute('roles.view', async () => {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      fullName: true,
      phone: true,
      avatarUrl: true,
      adminRole: true,
      accountStatus: true,
      lastActiveAt: true,
    },
  });
  return { data: { admins }, meta: { total: admins.length } };
});
