import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import { ApiError } from '@/lib/api';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';

const patchSchema = z.object({
  nameEn: z.string().trim().min(2).max(40),
  nameRw: z.string().trim().min(2).max(40),
  nameFr: z.string().trim().min(2).max(40),
  kind: z.enum(['PRODUCT', 'SERVICE']),
});

/** PATCH /api/admin/categories/[id] — rename/re-kind a category (curate the taxonomy). */
export const PATCH = adminRoute(
  'listings.remove',
  async (req, ctx: { params: { id: string } }, { admin }) => {
    const input = patchSchema.parse(await req.json().catch(() => ({})));
    const existing = await prisma.category.findUnique({ where: { id: ctx.params.id } });
    if (!existing) throw new ApiError('NOT_FOUND', 'Category not found.');

    const updated = await prisma.category.update({
      where: { id: ctx.params.id },
      data: input,
      select: { id: true, nameEn: true, nameRw: true, nameFr: true, kind: true },
    });

    await audit({
      actorId: admin.id,
      action: 'category.update',
      targetType: 'category',
      targetId: ctx.params.id,
      before: { nameEn: existing.nameEn, kind: existing.kind },
      after: { nameEn: updated.nameEn, kind: updated.kind },
    });
    revalidateTag('categories'); // public list is cached — refresh it
    return { data: updated };
  }
);

/** DELETE /api/admin/categories/[id] — remove a junk/duplicate category. Listings
 *  keep working; their categoryId is set null (see schema optional relation). */
export const DELETE = adminRoute(
  'listings.remove',
  async (_req, ctx: { params: { id: string } }, { admin }) => {
    const existing = await prisma.category.findUnique({
      where: { id: ctx.params.id },
      select: { id: true, nameEn: true, _count: { select: { listings: true } } },
    });
    if (!existing) throw new ApiError('NOT_FOUND', 'Category not found.');

    await prisma.category.delete({ where: { id: ctx.params.id } });

    await audit({
      actorId: admin.id,
      action: 'category.delete',
      targetType: 'category',
      targetId: ctx.params.id,
      before: { nameEn: existing.nameEn, listings: existing._count.listings },
    });
    revalidateTag('categories');
    return { data: { ok: true } };
  }
);
