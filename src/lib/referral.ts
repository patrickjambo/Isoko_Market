import 'server-only';
import { randomInt } from 'node:crypto';
import { prisma } from './prisma';
import { notify } from './notifications';
import { francsToMinor } from './utils';
import { REFERRAL_BONUS } from './pricing';

// Unambiguous alphabet (no 0/O/1/I) for codes users may read aloud/share.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferralCode(len = 7): string {
  let code = '';
  for (let i = 0; i < len; i++) code += ALPHABET[randomInt(0, ALPHABET.length)];
  return code;
}

/** Generate a referral code guaranteed unique against existing users. */
export async function uniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateReferralCode();
    const clash = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  // Extremely unlikely; widen the space as a fallback.
  return generateReferralCode(10);
}

/**
 * Link a newly-registered user to the referrer identified by `code`, and credit
 * the referrer's wallet with the referral bonus (Phase 5 referral system).
 * Best-effort: invalid/self codes are ignored.
 */
export async function applyReferral(newUserId: string, code: string): Promise<void> {
  const referrer = await prisma.user.findUnique({
    where: { referralCode: code.toUpperCase() },
    select: { id: true, fullName: true },
  });
  if (!referrer || referrer.id === newUserId) return;

  const bonus = francsToMinor(REFERRAL_BONUS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: newUserId }, data: { referredById: referrer.id } }),
    prisma.user.update({
      where: { id: referrer.id },
      data: { walletBalance: { increment: bonus } },
    }),
    prisma.transaction.create({
      data: {
        userId: referrer.id,
        type: 'TOPUP',
        amount: bonus,
        provider: 'MOCK',
        status: 'SUCCESS',
        metadata: { reason: 'referral' },
      },
    }),
  ]);

  await notify({
    userId: referrer.id,
    type: 'PAYMENT',
    title: 'Referral bonus earned',
    body: `You earned RWF ${REFERRAL_BONUS.toLocaleString()} — a friend joined with your code.`,
    href: '/referrals',
  });
}
