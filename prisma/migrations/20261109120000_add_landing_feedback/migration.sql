-- CreateEnum
CREATE TYPE "LandingFeedbackStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "LandingFeedback" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "status" "LandingFeedbackStatus" NOT NULL DEFAULT 'APPROVED',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingFeedback_status_idx" ON "LandingFeedback"("status");

-- CreateIndex
CREATE INDEX "LandingFeedback_createdAt_idx" ON "LandingFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "LandingFeedback" ADD CONSTRAINT "LandingFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
