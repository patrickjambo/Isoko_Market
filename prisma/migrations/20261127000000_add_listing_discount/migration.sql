-- Add discount fields to Listing table
ALTER TABLE "Listing" ADD COLUMN "discountPrice" DOUBLE PRECISION;
ALTER TABLE "Listing" ADD COLUMN "discountEndsAt" TIMESTAMP(3);

-- Index for Hot Deals queries
CREATE INDEX "Listing_discountEndsAt_idx" ON "Listing"("discountEndsAt");
