import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import { route, jsonOk, ApiError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { slugify } from '@/lib/utils';

const schema = z.object({
  name: z.string().trim().min(2, 'Category name is too short.').max(40),
  kind: z.enum(['PRODUCT', 'SERVICE']).default('PRODUCT'),
});

/**
 * POST /api/categories — a seller adds a category that doesn't exist yet
 * (dynamic categories). Recorded once and then visible to everyone, so the
 * taxonomy grows with real products. De-duplicates case-insensitively per kind
 * so we don't accumulate near-identical entries.
 */
export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();

  const limit = rateLimit(`category:${user.id}`, 10, 60 * 60 * 1000);
  if (!limit.success) throw new ApiError('RATE_LIMITED', 'Too many new categories. Try again later.');

  const { name, kind } = schema.parse(await req.json().catch(() => ({})));

  // Reuse an existing category with the same name + kind (any locale field).
  const existing = await prisma.category.findFirst({
    where: {
      kind,
      OR: [
        { nameEn: { equals: name, mode: 'insensitive' } },
        { nameRw: { equals: name, mode: 'insensitive' } },
        { nameFr: { equals: name, mode: 'insensitive' } },
      ],
    },
    select: { id: true, nameEn: true, kind: true },
  });
  if (existing) {
    return jsonOk({ id: existing.id, name: existing.nameEn, kind: existing.kind });
  }

  // Unique slug (append a short suffix if the base is taken).
  const base = slugify(name) || 'category';
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (!clash) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // The seller supplies one name; store it across the trilingual fields (an admin
  // or the AI localizer can refine translations later).
  const created = await prisma.category.create({
    data: { slug, nameEn: name, nameRw: name, nameFr: name, kind, createdById: user.id },
    select: { id: true, nameEn: true, kind: true },
  });

  // The category list is cached (getCategories) — refresh it so the new entry
  // shows for everyone immediately.
  revalidateTag('categories');

  return jsonOk({ id: created.id, name: created.nameEn, kind: created.kind }, { status: 201 });
});
