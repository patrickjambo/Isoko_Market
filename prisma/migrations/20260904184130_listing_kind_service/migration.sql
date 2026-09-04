-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('PRODUCT', 'SERVICE');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "kind" "ListingKind" NOT NULL DEFAULT 'PRODUCT';
