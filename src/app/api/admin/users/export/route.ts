import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api';
import { audit } from '@/lib/audit';
import { exportUsersToExcelBuffer } from '@/lib/export/excel';

const exportSchema = z.object({
  userIds: z.array(z.string()).optional(),
  q: z.string().trim().max(80).optional(),
  role: z.enum(['BUYER', 'SELLER', 'EMPLOYER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
  verifiedOnly: z.boolean().optional(),
  includeSensitiveId: z.boolean().optional().default(false),
});

/**
 * POST /api/admin/users/export — Export users to Excel (.xlsx).
 * Supports exporting all users, filtered users, or selected user IDs.
 * Authorized admins can include National ID numbers.
 */
export const POST = adminRoute(
  'users.view',
  async (req, _ctx, { admin, permissions }) => {
    const body = await req.json().catch(() => ({}));
    const { userIds, q, role, status, verifiedOnly, includeSensitiveId } =
      exportSchema.parse(body);

    const canExportSensitive =
      permissions.has('users.export_sensitive') || permissions.has('*');

    // If sensitive data was requested without permission, deny or enforce safety
    if (includeSensitiveId && !canExportSensitive) {
      throw new ApiError(
        'FORBIDDEN',
        'You lack authorization to export confidential National ID numbers.'
      );
    }

    const where: Prisma.UserWhereInput = {};

    if (userIds && userIds.length > 0) {
      // Export specific selected users
      where.id = { in: userIds };
    } else {
      // Export filtered or all users
      if (role) where.role = role;
      if (status) where.accountStatus = status;
      if (verifiedOnly) where.isVerified = true;
      if (q) {
        where.OR = [
          { fullName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { id: { equals: q } },
        ];
      }
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000, // Safe ceiling for single sheet export
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        country: true,
        accountStatus: true,
        verificationStatus: true,
        createdAt: true,
        nationalId: true,
      },
    });

    // Ensure deduplication
    const seen = new Set<string>();
    const uniqueUsers = users.filter((u) => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });

    const excelBuffer = exportUsersToExcelBuffer(uniqueUsers, {
      includeNationalId: includeSensitiveId,
    });

    // Audit log the export event
    await audit({
      actorId: admin.id,
      action: includeSensitiveId ? 'users.export_sensitive' : 'users.export',
      targetType: 'USER',
      reason: `Exported ${uniqueUsers.length} user records to Excel (.xlsx)${
        includeSensitiveId ? ' including verified National ID numbers' : ''
      }`,
      after: {
        count: uniqueUsers.length,
        filterApplied: { role, status, verifiedOnly, hasQuery: Boolean(q), selectedCount: userIds?.length },
        includeNationalId: Boolean(includeSensitiveId),
      },
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `zenova-users-${timestamp}.xlsx`;

    return new Response(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': excelBuffer.length.toString(),
      },
    });
  }
);
