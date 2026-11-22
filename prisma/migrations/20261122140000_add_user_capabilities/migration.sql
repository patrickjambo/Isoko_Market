-- Add capabilities array to User model (Phase 3: flexible multi-role account)
-- Users can explicitly activate multiple capabilities: BUYER, SELLER, SERVICE_PROVIDER, HIRER, JOB_SEEKER
-- This is additive — the existing role field is unchanged.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "capabilities" TEXT[] NOT NULL DEFAULT '{}';
