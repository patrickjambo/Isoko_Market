import { describe, it, expect } from 'vitest';
import { mockProvider } from '@/lib/payments/mock';

describe('mock payment provider', () => {
  const base = { currency: 'RWF' as const, phone: '+250788123456', reference: 'tx_1' };

  it('succeeds for normal amounts', async () => {
    const res = await mockProvider.charge({ ...base, amount: 200000 });
    expect(res.status).toBe('SUCCESS');
    expect(res.providerRef).toContain('tx_1');
  });

  it('simulates a decline for amounts ending in 13 minor units', async () => {
    const res = await mockProvider.charge({ ...base, amount: 100013 });
    expect(res.status).toBe('FAILED');
  });
});
