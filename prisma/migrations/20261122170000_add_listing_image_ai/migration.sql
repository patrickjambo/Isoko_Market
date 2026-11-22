-- Add AI-generated description and tags to ListingImage for visual search
ALTER TABLE "ListingImage" ADD COLUMN IF NOT EXISTS "aiDescription" TEXT;
ALTER TABLE "ListingImage" ADD COLUMN IF NOT EXISTS "aiTags" TEXT;

-- Index on aiTags for faster text search filtering
CREATE INDEX IF NOT EXISTS "ListingImage_aiTags_idx" ON "ListingImage"("aiTags");
