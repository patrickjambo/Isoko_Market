/*
  Warnings:

  - The `contactInfo` column on the `Job` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `contactInfo` column on the `Listing` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Job" DROP COLUMN "contactInfo",
ADD COLUMN     "contactInfo" JSONB;

-- AlterTable
ALTER TABLE "Listing" DROP COLUMN "contactInfo",
ADD COLUMN     "contactInfo" JSONB;
