import { z } from 'zod';
import { revalidateTag } from 'next/cache';
import { adminRoute } from '@/lib/admin-route';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';
import { flatten } from '@/lib/locale-overrides';

const getQuery = z.object({
  locale: z.enum(['rw', 'en', 'fr']).default('en'),
  q: z.string().trim().max(80).optional(),
});

/**
 * GET /api/admin/content?locale=&q= — searchable i18n keys with their base value
 * and any current override, so admins can edit strings without a deploy.
 */
export const GET = adminRoute('content.view', async (req) => {
  const { locale, q } = getQuery.parse(Object.fromEntries(new URL(req.url).searchParams));

  const base = flatten((await import(`@/messages/${locale}.json`)).default);
  const overrides = await prisma.localeString.findMany({ where: { locale } });
  const overrideMap = new Map(overrides.map((o) => [o.key, o.value]));

  let keys = Object.keys(base);
  if (q) {
    const needle = q.toLowerCase();
    keys = keys.filter((k) => k.toLowerCase().includes(needle) || base[k]!.toLowerCase().includes(needle));
  }
  keys = keys.slice(0, 60);

  return {
    data: {
      locale,
      entries: keys.map((key) => ({
        key,
        base: base[key]!,
        value: overrideMap.get(key) ?? '',
      })),
    },
    meta: { total: keys.length },
  };
});

const putSchema = z.object({
  locale: z.enum(['rw', 'en', 'fr']),
  key: z.string().trim().min(1).max(120),
  value: z.string().max(2000),
});

/** PUT /api/admin/content — set (or clear) an override; live via revalidateTag. */
export const PUT = adminRoute('content.edit', async (req, _ctx, { admin }) => {
  const { locale, key, value } = putSchema.parse(await req.json().catch(() => ({})));

  if (value.trim() === '') {
    await prisma.localeString
      .delete({ where: { locale_key: { locale, key } } })
      .catch(() => null);
  } else {
    await prisma.localeString.upsert({
      where: { locale_key: { locale, key } },
      create: { locale, key, value, updatedById: admin.id },
      update: { value, updatedById: admin.id },
    });
  }

  revalidateTag('locale-overrides');
  const log = await audit({
    actorId: admin.id,
    action: 'content.edit',
    targetType: 'LOCALE',
    targetId: `${locale}:${key}`,
    after: { value },
  });

  return { data: { ok: true }, meta: { audit: log } };
});
