-- CreateEnum
CREATE TYPE "SearchKind" AS ENUM ('JOB', 'LISTING');

-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "kind" "SearchKind" NOT NULL DEFAULT 'JOB',
ADD COLUMN     "maxPrice" INTEGER,
ADD COLUMN     "minPrice" INTEGER;

-- CreateIndex
CREATE INDEX "SavedSearch_kind_idx" ON "SavedSearch"("kind");
