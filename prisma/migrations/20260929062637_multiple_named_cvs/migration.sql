-- DropIndex
DROP INDEX "CV_userId_key";

-- AlterTable
ALTER TABLE "CV" ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'My CV';

-- CreateIndex
CREATE INDEX "CV_userId_idx" ON "CV"("userId");
