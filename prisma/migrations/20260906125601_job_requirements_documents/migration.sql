-- AlterEnum
ALTER TYPE "SeekerDocumentType" ADD VALUE 'DRIVING_LICENSE';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "requiredDocuments" "SeekerDocumentType"[] DEFAULT ARRAY[]::"SeekerDocumentType"[],
ADD COLUMN     "requirements" TEXT;
