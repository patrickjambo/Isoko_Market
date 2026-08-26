import { describe, it, expect } from 'vitest';
import { intentToRole, intentHome, landingFor, primaryWorkspace, isIntent, INTENTS } from '@/lib/onboarding';

describe('onboarding intent mapping', () => {
  it('writes EMPLOYER only for the hire intent, BUYER otherwise', () => {
    expect(intentToRole('hire')).toBe('EMPLOYER');
    expect(intentToRole('buy_sell')).toBe('BUYER');
    expect(intentToRole('find_work')).toBe('BUYER');
    expect(intentToRole('browse')).toBe('BUYER');
    expect(intentToRole(undefined)).toBe('BUYER');
  });

  it('lands each intent in the right first screen (§4 Step 4)', () => {
    expect(intentHome('buy_sell')).toBe('/marketplace');
    expect(intentHome('find_work')).toBe('/cv'); // straight into the CV builder
    expect(intentHome('hire')).toBe('/jobs/new'); // straight into Post a Job
    expect(intentHome('browse')).toBe('/'); // general blended home
    expect(intentHome(null)).toBe('/');
  });

  it('validates intent tokens', () => {
    expect(isIntent('hire')).toBe(true);
    expect(isIntent('nonsense')).toBe(false);
    expect(INTENTS).toHaveLength(4);
  });
});

describe('landingFor — role-aware login landing (bug fix)', () => {
  it('opens each returning user on their own role home', () => {
    // Buyer intent → personalized buyer home (not the seller dashboard).
    expect(landingFor({ role: 'BUYER', preferredRole: 'buy_sell' })).toBe('/');
    expect(landingFor({ role: 'BUYER', preferredRole: 'browse' })).toBe('/');
    // Job seeker (stays BUYER-role) → jobs home.
    expect(landingFor({ role: 'BUYER', preferredRole: 'find_work' })).toBe('/jobs');
    // Employer → employer dashboard (via role OR hire intent).
    expect(landingFor({ role: 'EMPLOYER', preferredRole: 'hire' })).toBe('/employer');
    expect(landingFor({ role: 'BUYER', preferredRole: 'hire' })).toBe('/employer');
    // Seller (evolved via first listing) → seller dashboard.
    expect(landingFor({ role: 'SELLER', preferredRole: 'buy_sell' })).toBe('/dashboard');
    // Admin → admin.
    expect(landingFor({ role: 'ADMIN', preferredRole: null })).toBe('/admin');
    // No signal → buyer home.
    expect(landingFor({ role: 'BUYER' })).toBe('/');
  });

  it('role wins over a stale intent (usage reflects the real home)', () => {
    // A seeker who later became a seller opens on the seller dashboard.
    expect(landingFor({ role: 'SELLER', preferredRole: 'find_work' })).toBe('/dashboard');
  });
});

describe('tie-break priority when multiple role signals coexist', () => {
  // Explicit, documented priority (NOT emergent):
  //   evolved role > signup intent;  EMPLOYER > SELLER > find_work > buyer.
  it('landingFor: evolved role beats signup intent', () => {
    // Has an active Listing (→ SELLER) AND a CV/Applications (find_work intent):
    // the SELLER role wins — the thing they actually did outranks the intent.
    expect(landingFor({ role: 'SELLER', preferredRole: 'find_work' })).toBe('/dashboard');
    // Employer who signed up to find work: EMPLOYER role wins.
    expect(landingFor({ role: 'EMPLOYER', preferredRole: 'find_work' })).toBe('/employer');
    // Employer role AND buy_sell intent: employer wins.
    expect(landingFor({ role: 'EMPLOYER', preferredRole: 'buy_sell' })).toBe('/employer');
  });

  it('primaryWorkspace uses the identical priority as landingFor', () => {
    expect(primaryWorkspace({ role: 'SELLER', preferredRole: 'find_work' })).toBe('seller');
    expect(primaryWorkspace({ role: 'EMPLOYER', preferredRole: 'find_work' })).toBe('employer');
    expect(primaryWorkspace({ role: 'BUYER', preferredRole: 'find_work' })).toBe('seeker');
    expect(primaryWorkspace({ role: 'BUYER', preferredRole: 'buy_sell' })).toBe('buyer');
    // hire intent maps to employer even before the role has evolved.
    expect(primaryWorkspace({ role: 'BUYER', preferredRole: 'hire' })).toBe('employer');
  });
});
