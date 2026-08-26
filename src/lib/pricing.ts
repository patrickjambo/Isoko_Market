/**
 * Premium feature pricing (Section 6.2 / 17 — "as priced in the business plan").
 * Amounts are in whole RWF and centralized here so they can be tuned without
 * touching UI or payment code. Adjust to match the finalized business-plan tiers.
 */
export const PRICING = {
  /** Boost a listing to "featured" for a period. */
  FEATURED_LISTING: 2000,
  /** Verified-seller subscription (per month). */
  VERIFIED_SUBSCRIPTION: 5000,
  /** Optional paid job posting (kept free by default in the MVP). */
  JOB_POST: 3000,
} as const;

export const FEATURE_DURATION_DAYS = 7;
export const SUBSCRIPTION_DURATION_DAYS = 30;

/** Wallet credit granted to a referrer when someone joins with their code. */
export const REFERRAL_BONUS = 500; // whole RWF
