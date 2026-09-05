-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "kind" "ListingKind" NOT NULL DEFAULT 'PRODUCT';

-- CreateIndex
CREATE INDEX "Category_kind_idx" ON "Category"("kind");
