export interface RwandanIdValidation {
  valid: boolean;
  normalizedId?: string;
  birthYear?: number;
  genderIndicator?: 'MALE' | 'FEMALE' | 'OTHER';
  isCitizen?: boolean;
  reason?: string;
}

/**
 * Validates a 16-digit Rwandan National Identification Number (Indangamuntu).
 * Format: 1 YYYY [7|8] XXXXXXX X XX
 * Digit 1: 1 = Rwandan Citizen, 2 = Foreigner / Refugee
 * Digits 2-5: Year of Birth
 * Digit 6: 8 = Male, 7 = Female
 * Remaining: unique serial & check digits
 */
export function validateRwandanIdNumber(rawId: string): RwandanIdValidation {
  if (!rawId) {
    return { valid: false, reason: 'ID number is empty' };
  }

  const clean = rawId.replace(/[\s\-_.]/g, '');

  if (!/^\d{16}$/.test(clean)) {
    return {
      valid: false,
      reason: `Expected 16 digits, got ${clean.length} digits`,
    };
  }

  const firstDigit = clean[0];
  const yearStr = clean.slice(1, 5);
  const genderDigit = clean[5];

  const birthYear = parseInt(yearStr, 10);
  const currentYear = new Date().getFullYear();

  if (isNaN(birthYear) || birthYear < 1910 || birthYear > currentYear) {
    return {
      valid: false,
      reason: `Invalid birth year encoded in ID: ${yearStr}`,
    };
  }

  const isCitizen = firstDigit === '1';
  const genderIndicator =
    genderDigit === '8' ? 'MALE' : genderDigit === '7' ? 'FEMALE' : 'OTHER';

  return {
    valid: true,
    normalizedId: clean,
    birthYear,
    genderIndicator,
    isCitizen,
  };
}

/**
 * Masks a 16-digit Rwandan national ID for privacy: 11995800****5024
 */
export function maskNationalId(id: string | null): string {
  if (!id) return 'Not recorded';
  const clean = id.replace(/\s+/g, '');
  if (clean.length < 8) return clean;
  return `${clean.slice(0, 8)}****${clean.slice(-4)}`;
}
