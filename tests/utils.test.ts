import { describe, it, expect } from 'vitest';
import { isActiveToday, slugify, initials } from '@/lib/utils';

// Note: francsToMinor / formatRWF are covered in money.test.ts.

describe('initials', () => {
  it('takes the first letter of the first two words, uppercased', () => {
    expect(initials('Patrick Jambo')).toBe('PJ');
    expect(initials('madonna')).toBe('M');
  });
  it('ignores extra whitespace and empty input', () => {
    expect(initials('  Jean  Claude  Van ')).toBe('JC');
    expect(initials('')).toBe('');
  });
});

describe('slugify', () => {
  it('lowercases, strips accents, and hyphenates', () => {
    expect(slugify('Green Hills Academy!')).toBe('green-hills-academy');
    expect(slugify('Héllo Wörld')).toBe('hello-world');
  });
  it('trims leading/trailing separators and caps length at 60', () => {
    expect(slugify('  --Spaced--  ')).toBe('spaced');
    expect(slugify('a'.repeat(70))).toHaveLength(60);
  });
});

describe('isActiveToday', () => {
  it('is true within 24h, false beyond it, false for empty', () => {
    expect(isActiveToday(new Date())).toBe(true);
    expect(isActiveToday(new Date(Date.now() - 23 * 60 * 60 * 1000))).toBe(true);
    expect(isActiveToday(new Date(Date.now() - 25 * 60 * 60 * 1000))).toBe(false);
    expect(isActiveToday(null)).toBe(false);
    expect(isActiveToday(undefined)).toBe(false);
  });
  it('accepts ISO strings too', () => {
    expect(isActiveToday(new Date().toISOString())).toBe(true);
  });
});
