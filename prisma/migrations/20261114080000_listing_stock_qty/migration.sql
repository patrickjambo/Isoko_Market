-- Add optional stock/quantity management to Listing.
-- NULL = no stock limit (fully backward-compatible with existing listings).
ALTER TABLE "Listing" ADD COLUMN "stockQty" INTEGER;
