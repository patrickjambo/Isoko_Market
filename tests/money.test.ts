import { describe, it, expect } from 'vitest';
import { francsToMinor, formatRWF } from '@/lib/utils';

describe('money helpers', () => {
  it('converts whole francs to stored minor units', () => {
    expect(francsToMinor(1000)).toBe(100000);
    expect(francsToMinor(0)).toBe(0);
    expect(francsToMinor(1)).toBe(100);
  });

  it('round-trips francs → minor → display', () => {
    const minor = francsToMinor(145000);
    // Displayed value should contain the franc amount (formatting/locale aside).
    expect(formatRWF(minor, 'en')).toMatch(/145,?000/);
  });

  it('never shows fractional francs', () => {
    expect(formatRWF(199, 'en')).not.toContain('.');
  });
});
