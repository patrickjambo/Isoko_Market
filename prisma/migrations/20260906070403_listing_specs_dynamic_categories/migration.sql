-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "specs" JSONB;
