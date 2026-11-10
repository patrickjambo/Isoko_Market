/**
 * One-time fix: sets adminRole='SUPER_ADMIN' for every user in ADMIN_EMAILS
 * who already has role='ADMIN' but adminRole=null (manual DB seed issue).
 *
 * Run from project root:
 *   npx tsx scripts/fix-admin-role.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const moderatorEmails = (process.env.MODERATOR_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const allStaff = [...adminEmails.map((e) => ({ email: e, role: 'SUPER_ADMIN' as const })),
                    ...moderatorEmails.map((e) => ({ email: e, role: 'MODERATOR' as const }))];

  if (allStaff.length === 0) {
    console.log('No ADMIN_EMAILS or MODERATOR_EMAILS configured in .env — nothing to do.');
    return;
  }

  for (const { email, role } of allStaff) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`  ⚠  ${email} — not found in DB (not registered yet)`);
      continue;
    }
    if (user.adminRole) {
      console.log(`  ✓  ${email} — already has adminRole=${user.adminRole}, skipping`);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN', adminRole: role },
    });
    console.log(`  ✅ ${email} — fixed: role=ADMIN, adminRole=${role}`);
  }

  console.log('\nDone.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
