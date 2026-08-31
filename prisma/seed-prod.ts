/**
 * Production-safe seed. Idempotently upserts the reference data the app needs to
 * FUNCTION (marketplace categories — a listing can't be published without one).
 *
 * Unlike prisma/seed.ts this does NOT delete anything and creates no demo
 * users/listings, so it's safe to run on every deploy — it's wired into
 * `vercel-build` after `prisma migrate deploy`. Keyed by the unique slug, so a
 * re-run only refreshes names/icons and adds any new categories.
 */
import { PrismaClient } from '@prisma/client';
import { CATEGORIES } from './reference-data';

const prisma = new PrismaClient();

async function main() {
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { nameEn: c.nameEn, nameRw: c.nameRw, nameFr: c.nameFr, icon: c.icon },
      create: c,
    });
  }
  const total = await prisma.category.count();
  console.log(`✅  Reference data ensured — ${CATEGORIES.length} categories upserted (${total} total).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('❌  seed-prod failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
