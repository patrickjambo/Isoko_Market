#!/usr/bin/env node
/**
 * Create (or update) platform staff accounts that log in with email + password.
 *
 *   node scripts/create-staff.mjs            # create missing accounts, print passwords
 *   node scripts/create-staff.mjs --reset    # also reset the password of EXISTING accounts
 *
 * Runs against whatever DATABASE_URL is in the environment, so you can point it
 * at production to provision the real accounts:
 *   DATABASE_URL="postgres://…prod…" node scripts/create-staff.mjs
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();
const RESET = process.argv.includes('--reset');

// The staff to provision. Edit or extend as needed.
const STAFF = [
  { email: 'kaleabuba153@gmail.com', fullName: 'Super Admin', adminRole: 'SUPER_ADMIN' },
  { email: 'kaleabuba071@gmail.com', fullName: 'Moderator', adminRole: 'MODERATOR' },
];

/** Readable strong password: letters + digits, guaranteed to pass the policy. */
function genPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(14);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10)}9a`;
}

async function uniqueReferralCode() {
  for (;;) {
    const code = randomBytes(4).toString('hex').toUpperCase();
    const clash = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!clash) return code;
  }
}

async function main() {
  const results = [];
  for (const s of STAFF) {
    const email = s.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    let password = null;
    if (!existing || RESET || !existing.passwordHash) {
      password = genPassword();
    }
    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: 'ADMIN',
          adminRole: s.adminRole,
          accountStatus: 'ACTIVE',
          ...(passwordHash ? { passwordHash } : {}),
        },
      });
      results.push({ email, role: s.adminRole, action: 'updated', password });
    } else {
      await prisma.user.create({
        data: {
          email,
          fullName: s.fullName,
          role: 'ADMIN',
          adminRole: s.adminRole,
          accountStatus: 'ACTIVE',
          passwordHash,
          referralCode: await uniqueReferralCode(),
        },
      });
      results.push({ email, role: s.adminRole, action: 'created', password });
    }
  }

  console.log('\n─────────────  STAFF ACCOUNTS  ─────────────');
  for (const r of results) {
    console.log(`\n  ${r.email}`);
    console.log(`    role:     ${r.role}`);
    console.log(`    status:   ${r.action}`);
    console.log(`    password: ${r.password ?? '(unchanged — use --reset to set a new one)'}`);
  }
  console.log('\n  Log in at /login with the email + password, then change it under');
  console.log('  Admin → Account. Store these somewhere safe — they are not shown again.\n');
}

main()
  .catch((e) => {
    console.error('Failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
