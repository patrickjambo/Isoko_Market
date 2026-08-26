import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rateLimit } from '@/lib/rate-limit';

// The limiter reads Date.now(); fake timers make window math deterministic.
// Each test uses a distinct key because the store is module-global.
describe('rateLimit — fixed-window (Section 10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to the limit, decrementing remaining, then blocks', () => {
    const key = 'otp:req';
    expect(rateLimit(key, 3, 60_000)).toMatchObject({ success: true, remaining: 2 });
    expect(rateLimit(key, 3, 60_000)).toMatchObject({ success: true, remaining: 1 });
    expect(rateLimit(key, 3, 60_000)).toMatchObject({ success: true, remaining: 0 });

    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('starts a fresh window once the previous one elapses', () => {
    const key = 'login:attempt';
    expect(rateLimit(key, 1, 1_000).success).toBe(true); // consumes the single allowance
    expect(rateLimit(key, 1, 1_000).success).toBe(false); // blocked within the window

    vi.advanceTimersByTime(1_001); // window passes
    expect(rateLimit(key, 1, 1_000).success).toBe(true); // reset
  });

  it('sets resetAt to now + windowMs and holds it steady across a window', () => {
    const first = rateLimit('steady', 5, 30_000);
    expect(first.resetAt).toBe(1_000_000 + 30_000);

    vi.advanceTimersByTime(5_000);
    const second = rateLimit('steady', 5, 30_000);
    expect(second.resetAt).toBe(first.resetAt); // same window, not extended
    expect(second.remaining).toBe(3);
  });

  it('keeps separate keys independent', () => {
    expect(rateLimit('a', 1, 60_000).success).toBe(true);
    expect(rateLimit('a', 1, 60_000).success).toBe(false);
    // A different key is unaffected by 'a' being exhausted.
    expect(rateLimit('b', 1, 60_000).success).toBe(true);
  });
});
