import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VERIFY_SNOOZE_KEY,
  VERIFY_SNOOZE_DURATION_MS,
  isVerificationPromptEligible,
} from '@/lib/verification-prompt';

describe('Verification prompt modal snooze & state logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('correctly calculates snooze expiration timestamp', () => {
    const now = 1700000000000;
    vi.setSystemTime(now);

    const snoozedUntil = now + VERIFY_SNOOZE_DURATION_MS;
    expect(snoozedUntil > now).toBe(true);

    // Fast-forward past snooze duration
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(snoozedUntil > Date.now()).toBe(false);
  });

  it('determines verification prompt eligibility correctly', () => {
    const now = 1700000000000;

    // Anonymous guests should never see the prompt
    expect(
      isVerificationPromptEligible({
        isLoggedIn: false,
        status: 'UNVERIFIED',
        now,
      })
    ).toBe(false);

    // Verified users are never eligible
    expect(
      isVerificationPromptEligible({
        isLoggedIn: true,
        status: 'VERIFIED',
        now,
      })
    ).toBe(false);

    // Pending users (already submitted ID) are not eligible
    expect(
      isVerificationPromptEligible({
        isLoggedIn: true,
        status: 'PENDING',
        now,
      })
    ).toBe(false);

    // Unverified users with no snooze are eligible
    expect(
      isVerificationPromptEligible({
        isLoggedIn: true,
        status: 'UNVERIFIED',
        now,
      })
    ).toBe(true);

    // Rejected users with no snooze are eligible to retry
    expect(
      isVerificationPromptEligible({
        isLoggedIn: true,
        status: 'REJECTED',
        now,
      })
    ).toBe(true);

    // Snoozed users are NOT eligible while snooze is active
    expect(
      isVerificationPromptEligible({
        isLoggedIn: true,
        status: 'UNVERIFIED',
        snoozedUntil: now + 60000,
        now,
      })
    ).toBe(false);

    // Once snooze expires, eligible again
    expect(
      isVerificationPromptEligible({
        isLoggedIn: true,
        status: 'UNVERIFIED',
        snoozedUntil: now - 1000,
        now,
      })
    ).toBe(true);

    // Never show on verify or auth routes
    expect(
      isVerificationPromptEligible({
        isLoggedIn: true,
        status: 'UNVERIFIED',
        pathname: '/rw/verify',
        now,
      })
    ).toBe(false);
    expect(
      isVerificationPromptEligible({
        isLoggedIn: true,
        status: 'UNVERIFIED',
        pathname: '/en/login',
        now,
      })
    ).toBe(false);
    expect(
      isVerificationPromptEligible({
        isLoggedIn: true,
        status: 'UNVERIFIED',
        pathname: '/marketplace',
        now,
      })
    ).toBe(true);
    expect(
      isVerificationPromptEligible({
        isLoggedIn: true,
        status: 'UNVERIFIED',
        pathname: '/dashboard',
        now,
      })
    ).toBe(true);
  });
});
