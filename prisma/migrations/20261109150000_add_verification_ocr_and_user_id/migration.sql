-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nationalId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'Rwanda';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);

-- AlterTable VerificationRequest
ALTER TABLE "VerificationRequest" ADD COLUMN IF NOT EXISTS "extractedFullName" TEXT;
ALTER TABLE "VerificationRequest" ADD COLUMN IF NOT EXISTS "extractedIdNumber" TEXT;
ALTER TABLE "VerificationRequest" ADD COLUMN IF NOT EXISTS "extractedCountry" TEXT;
ALTER TABLE "VerificationRequest" ADD COLUMN IF NOT EXISTS "ocrConfidence" DOUBLE PRECISION;
ALTER TABLE "VerificationRequest" ADD COLUMN IF NOT EXISTS "ocrRawText" TEXT;
ALTER TABLE "VerificationRequest" ADD COLUMN IF NOT EXISTS "needsManualReview" BOOLEAN NOT NULL DEFAULT false;
