import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';

const querySchema = z.object({
  q: z.string().trim().max(80).optional(),
  role: z.enum(['BUYER', 'SELLER', 'EMPLOYER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
  verifiedOnly: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const PAGE_SIZE = 20;

/** GET /api/admin/users — searchable, paginated user directory. */
export const GET = adminRoute('users.view', async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const { q, role, status, verifiedOnly, page } = querySchema.parse(params);

  const where: Prisma.UserWhereInput = {};
  if (role) where.role = role;
  if (status) where.accountStatus = status;
  if (verifiedOnly === 'true') where.isVerified = true;
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { id: { equals: q } },
      { nationalId: { contains: q } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        country: true,
        nationalId: true,
        verifiedAt: true,
        role: true,
        adminRole: true,
        isVerified: true,
        verificationStatus: true,
        accountStatus: true,
        statusReason: true,
        createdAt: true,
        lastActiveAt: true,
        verificationRequest: {
          select: {
            reviewedAt: true,
            reviewNote: true,
            reviewedBy: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { data: { users }, meta: { total, page, pageSize: PAGE_SIZE } };
});
