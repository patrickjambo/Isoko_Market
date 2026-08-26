import { describe, it, expect } from 'vitest';
import {
  normalizeRwandaPhone,
  isValidRwandaPhone,
  detectCarrier,
  formatPhoneDisplay,
} from '@/lib/phone';

describe('normalizeRwandaPhone', () => {
  it('normalizes all accepted local/international forms to E.164', () => {
    expect(normalizeRwandaPhone('0788123456')).toBe('+250788123456');
    expect(normalizeRwandaPhone('+250788123456')).toBe('+250788123456');
    expect(normalizeRwandaPhone('250788123456')).toBe('+250788123456');
    expect(normalizeRwandaPhone('078 812 3456')).toBe('+250788123456');
    expect(normalizeRwandaPhone('078-812-3456')).toBe('+250788123456');
  });

  it('accepts MTN (78/79) and Airtel (72/73) prefixes', () => {
    expect(normalizeRwandaPhone('0728123456')).toBe('+250728123456');
    expect(normalizeRwandaPhone('0738123456')).toBe('+250738123456');
    expect(normalizeRwandaPhone('0798123456')).toBe('+250798123456');
  });

  it('rejects invalid numbers', () => {
    expect(normalizeRwandaPhone('0700123456')).toBeNull(); // 70 not a mobile prefix
    expect(normalizeRwandaPhone('078812345')).toBeNull(); // too short
    expect(normalizeRwandaPhone('0788123456789')).toBeNull(); // too long
    expect(normalizeRwandaPhone('hello')).toBeNull();
  });
});

describe('isValidRwandaPhone', () => {
  it('mirrors normalization validity', () => {
    expect(isValidRwandaPhone('0788123456')).toBe(true);
    expect(isValidRwandaPhone('0700000000')).toBe(false);
  });
});

describe('detectCarrier', () => {
  it('routes MoMo vs Airtel by prefix', () => {
    expect(detectCarrier('+250788123456')).toBe('mtn');
    expect(detectCarrier('+250798123456')).toBe('mtn');
    expect(detectCarrier('+250728123456')).toBe('airtel');
    expect(detectCarrier('+250738123456')).toBe('airtel');
  });
});

describe('formatPhoneDisplay', () => {
  it('formats E.164 for humans', () => {
    expect(formatPhoneDisplay('+250788123456')).toBe('+250 78 812 3456');
  });
});
