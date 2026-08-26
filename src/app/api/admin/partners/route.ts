import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { partnerSchema } from '@/lib/validators/misc';
import { slugify } from '@/lib/utils';
import { audit } from '@/lib/audit';

/** GET /api/admin/partners — list partners. */
export const GET = adminRoute('partners.view', async () => {
  const partners = await prisma.partner.findMany({ orderBy: { createdAt: 'desc' } });
  return { data: { partners }, meta: { total: partners.length } };
});

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || 'partner';
  let slug = base;
  let n = 1;
  while (await prisma.partner.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${++n}`;
  }
  return slug;
}

/** POST /api/admin/partners — register a cooperative / NGO / MSME. */
export const POST = adminRoute('partners.manage', async (req, _ctx, { admin }) => {
  const input = partnerSchema.parse(await req.json().catch(() => ({})));
  const partner = await prisma.partner.create({
    data: { ...input, brandColor: input.brandColor || null, slug: await uniqueSlug(input.name) },
  });
  const log = await audit({
    actorId: admin.id,
    action: 'partners.manage',
    targetType: 'PARTNER',
    targetId: partner.id,
    after: { name: partner.name, slug: partner.slug },
  });
  return { data: { partner }, meta: { audit: log } };
});
