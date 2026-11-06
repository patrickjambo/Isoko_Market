import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://isoko:pass@localhost:5544/isoko';
  process.env.AUTH_SECRET = 'dev-only-secret-change-me-in-production-0123456789abcdef';
});

describe('Google OAuth Helper', () => {
  it('generates a 48-character hex state token', async () => {
    const { generateState } = await import('@/lib/google-oauth');
    const s1 = generateState();
    const s2 = generateState();
    expect(s1).toHaveLength(48);
    expect(s2).toHaveLength(48);
    expect(s1).not.toBe(s2);
  });

  it('builds callback URL targeting /api/auth/google/callback with default or custom origin', async () => {
    const { callbackUrl } = await import('@/lib/google-oauth');
    const cb = callbackUrl();
    expect(cb).toContain('/api/auth/google/callback');

    const customCb = callbackUrl('https://mycustomdomain.com');
    expect(customCb).toBe('https://mycustomdomain.com/api/auth/google/callback');
  });

  it('detects OAuth enabled status', async () => {
    const { isGoogleOAuthEnabled, isRealGoogleConfigured } = await import('@/lib/google-oauth');
    expect(typeof isGoogleOAuthEnabled()).toBe('boolean');
    expect(typeof isRealGoogleConfigured()).toBe('boolean');
  });

  it('builds authentication URL with valid parameters', async () => {
    const { generateState, buildAuthUrl } = await import('@/lib/google-oauth');
    const state = generateState();
    const url = buildAuthUrl(state, '/marketplace');
    expect(url).toBeDefined();
    expect(url).toContain(state);
    expect(url.startsWith('http://') || url.startsWith('https://')).toBe(true);
  });

  it('provides a dev mock user profile in development mode without external calls', async () => {
    const { fetchGoogleUser } = await import('@/lib/google-oauth');
    const mockUser = await fetchGoogleUser('dev_google_mock');
    expect(mockUser).toBeDefined();
    expect(mockUser.email).toContain('@');
    expect(mockUser.verified_email).toBe(true);
    expect(mockUser.id).toBeDefined();
  });
});
