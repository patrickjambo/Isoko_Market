/**
 * Production-safe seed. Idempotently upserts the reference data the app needs to
 * FUNCTION (marketplace categories — a listing can't be published without one).
 * Also reconciles admin roles so ADMIN_EMAILS users are always SUPER_ADMIN.
 *
 * Unlike prisma/seed.ts this does NOT delete anything and creates no demo
 * users/listings, so it's safe to run on every deploy — it's wired into
 * `vercel-build` after `prisma migrate deploy`. Keyed by the unique slug, so a
 * re-run only refreshes names/icons and adds any new categories.
 */
import { PrismaClient } from '@prisma/client';
import { CATEGORIES } from './reference-data';

const prisma = new PrismaClient();

/** Parse a comma-separated env list into lowercase email set. */
function parseEmails(env: string | undefined) {
  return (env ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

async function main() {
  // ── 1. Upsert categories ───────────────────────────────────────────────
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { nameEn: c.nameEn, nameRw: c.nameRw, nameFr: c.nameFr, icon: c.icon, kind: c.kind },
      create: c,
    });
  }
  const total = await prisma.category.count();
  console.log(`✅  Reference data ensured — ${CATEGORIES.length} categories upserted (${total} total).`);

  // ── 2. Reconcile admin roles from environment config ───────────────────
  // Ensures ADMIN_EMAILS users are always SUPER_ADMIN and MODERATOR_EMAILS
  // users are MODERATOR, even if they were seeded with a different role.
  // This is idempotent and safe to run on every deploy.
  const adminEmails = parseEmails(process.env.ADMIN_EMAILS);
  const moderatorEmails = parseEmails(process.env.MODERATOR_EMAILS);

  for (const email of adminEmails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;
    if (user.role === 'ADMIN' && user.adminRole === 'SUPER_ADMIN') {
      console.log(`✅  ${email} — already SUPER_ADMIN`);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN', adminRole: 'SUPER_ADMIN' },
    });
    console.log(`✅  ${email} — promoted to SUPER_ADMIN`);
  }

  for (const email of moderatorEmails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;
    // Don't downgrade a SUPER_ADMIN who also happens to be in moderator list
    if (user.adminRole === 'SUPER_ADMIN') continue;
    if (user.role === 'ADMIN' && user.adminRole === 'MODERATOR') {
      console.log(`✅  ${email} — already MODERATOR`);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN', adminRole: 'MODERATOR' },
    });
    console.log(`✅  ${email} — promoted to MODERATOR`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('❌  seed-prod failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
