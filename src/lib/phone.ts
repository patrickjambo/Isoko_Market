/**
 * Rwandan phone-number handling. Phone is the primary identity on Isoko
 * (mirrors mobile-money habits — Section 4.1), so normalization must be strict
 * and consistent everywhere a phone is stored or looked up.
 */

const RW_MOBILE = /^(?:\+?250|0)?(7[2389]\d{7})$/;

/** Normalize any accepted local/international form to E.164 (+2507XXXXXXXX). */
export function normalizeRwandaPhone(input: string): string | null {
  const cleaned = input.replace(/[\s\-()]/g, '');
  const match = cleaned.match(RW_MOBILE);
  if (!match) return null;
  return `+250${match[1]}`;
}

export function isValidRwandaPhone(input: string): boolean {
  return normalizeRwandaPhone(input) !== null;
}

/** Human-friendly display: +250 78 123 4567 */
export function formatPhoneDisplay(e164: string): string {
  const m = e164.match(/^\+250(7\d)(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `+250 ${m[1]} ${m[2]} ${m[3]}`;
}

/** Detect carrier for routing MoMo vs Airtel Money (078/079 = MTN, 072/073 = Airtel). */
export function detectCarrier(e164: string): 'mtn' | 'airtel' | 'unknown' {
  const m = e164.match(/^\+250(7[2389])/);
  if (!m) return 'unknown';
  const prefix = m[1];
  if (prefix === '78' || prefix === '79') return 'mtn';
  if (prefix === '72' || prefix === '73') return 'airtel';
  return 'unknown';
}
