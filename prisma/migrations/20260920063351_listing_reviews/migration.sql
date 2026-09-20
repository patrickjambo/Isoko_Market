-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "listingId" TEXT,
ADD COLUMN     "serviceRequestId" TEXT;

-- CreateIndex
CREATE INDEX "Listing_ratingAvg_idx" ON "Listing"("ratingAvg");

-- CreateIndex
CREATE INDEX "Review_listingId_idx" ON "Review"("listingId");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
