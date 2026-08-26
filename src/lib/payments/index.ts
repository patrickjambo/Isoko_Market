import 'server-only';
import type { PaymentProviderName, TransactionType } from '@prisma/client';
import { prisma } from '../prisma';
import { env } from '../env';
import { detectCarrier } from '../phone';
import type { PaymentProvider } from './types';
import { mockProvider } from './mock';
import { createMtnProvider } from './momo';

/** Resolve the active provider from env, with per-charge carrier routing. */
function resolveProvider(preferred?: PaymentProviderName): PaymentProvider {
  if (preferred === 'MOCK' || env.PAYMENTS_PROVIDER === 'mock') return mockProvider;
  if (preferred === 'MTN_MOMO' || env.PAYMENTS_PROVIDER === 'mtn_momo') {
    return createMtnProvider();
  }
  // Airtel adapter would slot in here; fall back to mock in dev.
  return mockProvider;
}

export type StartPaymentInput = {
  userId: string;
  phone: string;
  type: TransactionType;
  /** Amount in RWF minor units. */
  amount: number;
  metadata?: Record<string, unknown>;
};

/**
 * Orchestrates a payment end-to-end: writes a PENDING Transaction, calls the
 * provider, then reconciles the row. All money math stays in one place.
 */
export async function startPayment(input: StartPaymentInput) {
  const carrier = detectCarrier(input.phone);
  const providerName: PaymentProviderName =
    env.PAYMENTS_PROVIDER === 'mock'
      ? 'MOCK'
      : carrier === 'airtel'
        ? 'AIRTEL_MONEY'
        : 'MTN_MOMO';

  const tx = await prisma.transaction.create({
    data: {
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      provider: providerName,
      status: 'PENDING',
      metadata: (input.metadata ?? {}) as object,
    },
  });

  const provider = resolveProvider(providerName);
  const result = await provider.charge({
    amount: input.amount,
    currency: 'RWF',
    phone: input.phone,
    reference: tx.id,
    description: input.type,
  });

  const updated = await prisma.transaction.update({
    where: { id: tx.id },
    data: { status: result.status, momoRef: result.providerRef },
  });

  return { transaction: updated, result };
}

export * from './types';
