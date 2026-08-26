import { describe, it, expect } from 'vitest';
import { generateOtp, hashOtp, verifyOtp } from '@/lib/crypto';

describe('OTP crypto', () => {
  it('generates a 6-digit numeric code', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateOtp();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('hashes deterministically and never returns the plaintext', () => {
    const hash = hashOtp('123456');
    expect(hash).toBe(hashOtp('123456'));
    expect(hash).not.toContain('123456');
    expect(hash).toHaveLength(64); // sha256 hex
  });

  it('verifies the correct code and rejects wrong ones', () => {
    const hash = hashOtp('420690');
    expect(verifyOtp('420690', hash)).toBe(true);
    expect(verifyOtp('000000', hash)).toBe(false);
    expect(verifyOtp('42069', hash)).toBe(false);
  });
});
