import 'server-only';
import type { PaymentProviderName, TransactionType } from '@prisma/client';
import { prisma } from '../prisma';
import { env } from '../env';
import { detectCarrier } from '../phone';
import type { PaymentProvider, PayoutTarget } from './types';
import { mockProvider } from './mock';
import { createMtnProvider } from './momo';
import { createAirtelProvider } from './airtel';
import { createCentriPayProvider } from './centripay';

/**
 * Resolve the live provider. With PAYMENTS_PROVIDER=auto (default) we pick by
 * the payer's carrier and by which credentials are actually configured, falling
 * back to CentriPay then the mock — so adding keys in env is all it takes to go
 * live, and a missing/half-configured provider never hard-fails a checkout.
 */
function resolveProvider(carrier: 'mtn' | 'airtel' | 'unknown'): PaymentProvider {
  const mtn = createMtnProvider();
  const airtel = createAirtelProvider();
  const centri = createCentriPayProvider();
  const orElse = (p: PaymentProvider) =>
    p.configured ? p : centri.configured ? centri : mockProvider;

  switch (env.PAYMENTS_PROVIDER) {
    case 'mock':
      return mockProvider;
    case 'mtn_momo':
      return orElse(mtn);
    case 'airtel_money':
      return orElse(airtel);
    case 'centripay':
      return centri.configured ? centri : mockProvider;
    case 'auto':
    default: {
      // Prefer the payer's own carrier when it's configured.
      if (carrier === 'airtel' && airtel.configured) return airtel;
      if (carrier === 'mtn' && mtn.configured) return mtn;
      // Otherwise any configured carrier, then the aggregator, then mock.
      if (mtn.configured) return mtn;
      if (airtel.configured) return airtel;
      if (centri.configured) return centri;
      return mockProvider;
    }
  }
}

/** The provider that would handle a charge from this phone (for display/routing). */
export function getProvider(phone: string): PaymentProvider {
  return resolveProvider(detectCarrier(phone));
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
 * Orchestrates a collection end-to-end: writes a PENDING Transaction, calls the
 * provider, then reconciles the row. All money math stays in one place.
 */
export async function startPayment(input: StartPaymentInput) {
  const provider = resolveProvider(detectCarrier(input.phone));

  const tx = await prisma.transaction.create({
    data: {
      userId: input.userId,
      type: input.type,
      amount: input.amount,
      provider: provider.name as PaymentProviderName,
      status: 'PENDING',
      metadata: (input.metadata ?? {}) as object,
    },
  });

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

  return { transaction: updated, result, provider: provider.name };
}

/**
 * Disburse to a seller's payout target (phone or merchant MoMo code). Routed to
 * the same provider family; returns the provider result (async → PENDING).
 */
export async function startPayout(input: {
  amount: number;
  target: PayoutTarget;
  reference: string;
  /** When the target is a merchant code, pick the provider by this phone's carrier. */
  routeByPhone?: string;
  description?: string;
}) {
  const routePhone = input.target.kind === 'phone' ? input.target.value : (input.routeByPhone ?? '');
  const provider = resolveProvider(detectCarrier(routePhone));
  return provider.payout({
    amount: input.amount,
    currency: 'RWF',
    target: input.target,
    reference: input.reference,
    description: input.description,
  });
}

export * from './types';
