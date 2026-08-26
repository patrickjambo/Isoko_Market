import 'server-only';
import { prisma } from './prisma';

/**
 * Wallet-balance reconciliation (from the Rule 1 audit).
 *
 * `User.walletBalance` is a denormalized money aggregate. It is NOT a naive
 * `sum(Transaction where status=SUCCESS)` for this schema, because:
 *   • an ESCROW transaction is owned by the BUYER (`Transaction.userId = buyer`)
 *     but the funds credit the SELLER on release — so summing a user's own
 *     transactions would miss the seller's credit and wrongly count the buyer's;
 *   • FEATURED_LISTING / JOB_POST / SUBSCRIPTION payments are charged via mobile
 *     money and never touch the wallet, so their transaction rows must be
 *     excluded.
 *
 * The wallet is currently credit-only (no withdrawals/debits exist), so the
 * true expected balance is:
 *
 *     expected(user) = Σ TOPUP transactions (incl. referral bonuses, SUCCESS)
 *                    + Σ Order.amount where the user is the SELLER and the order
 *                        COMPLETED (escrow released to them)
 *
 * This function only DETECTS and LOGS drift — it never auto-corrects, so a
 * genuine bug is surfaced for a human rather than silently papered over.
 */
export type WalletMismatch = {
  userId: string;
  fullName: string;
  balance: number; // stored walletBalance (RWF minor units)
  expected: number; // reconstructed from the ledger
  delta: number; // balance - expected (positive = phantom credit)
};

export type ReconcileResult = {
  checkedAt: string;
  usersChecked: number;
  mismatches: WalletMismatch[];
};

export async function reconcileWallets(): Promise<ReconcileResult> {
  const [topups, escrowCredits, nonZero] = await Promise.all([
    // Wallet top-ups (real top-ups AND referral bonuses, which are recorded as
    // TOPUP transactions) — the only transaction type that credits the wallet.
    prisma.transaction.groupBy({
      by: ['userId'],
      where: { status: 'SUCCESS', type: 'TOPUP' },
      _sum: { amount: true },
    }),
    // Escrow releases credit the seller; there is no seller-owned tx row, so we
    // read the credit straight off completed orders.
    prisma.order.groupBy({
      by: ['sellerId'],
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    }),
    // Any user holding a non-zero balance must be reconciled even if they have
    // no ledger entries (that would itself be a phantom balance).
    prisma.user.findMany({ where: { walletBalance: { not: 0 } }, select: { id: true } }),
  ]);

  const expected = new Map<string, number>();
  for (const t of topups) expected.set(t.userId, (expected.get(t.userId) ?? 0) + (t._sum.amount ?? 0));
  for (const e of escrowCredits) expected.set(e.sellerId, (expected.get(e.sellerId) ?? 0) + (e._sum.amount ?? 0));

  const userIds = new Set<string>([...expected.keys(), ...nonZero.map((u) => u.id)]);
  if (userIds.size === 0) return { checkedAt: new Date().toISOString(), usersChecked: 0, mismatches: [] };

  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, fullName: true, walletBalance: true },
  });

  const mismatches: WalletMismatch[] = [];
  for (const u of users) {
    const exp = expected.get(u.id) ?? 0;
    if (u.walletBalance !== exp) {
      mismatches.push({
        userId: u.id,
        fullName: u.fullName,
        balance: u.walletBalance,
        expected: exp,
        delta: u.walletBalance - exp,
      });
    }
  }

  if (mismatches.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[wallet-reconcile] ${mismatches.length} balance mismatch(es) out of ${users.length} checked:`,
      mismatches
    );
  }

  return { checkedAt: new Date().toISOString(), usersChecked: users.length, mismatches };
}
