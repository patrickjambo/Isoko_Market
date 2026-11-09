export const VERIFY_SNOOZE_KEY = 'zenova_verify_snoozed_until';
export const VERIFY_SNOOZE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/**
 * Returns true if the user should be prompted with the verification reminder modal.
 * Verified and pending users (who have already submitted an ID) are never prompted.
 */
export function isVerificationPromptEligible({
  isLoggedIn,
  status,
  snoozedUntil,
  now = Date.now(),
  pathname,
}: {
  isLoggedIn: boolean;
  status: VerificationStatus | string | null | undefined;
  snoozedUntil?: number | null;
  now?: number;
  pathname?: string;
}): boolean {
  if (!isLoggedIn) return false;
  if (status === 'VERIFIED' || status === 'PENDING') return false;
  if (
    pathname &&
    (pathname.includes('/verify') ||
      pathname.includes('/login') ||
      pathname.includes('/register'))
  ) {
    return false;
  }
  if (snoozedUntil && snoozedUntil > now) return false;
  return true;
}
