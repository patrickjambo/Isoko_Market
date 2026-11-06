-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'ACTIVE', 'EXPIRED', 'GRACE');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "subscriptionAnnualPrice" INTEGER NOT NULL DEFAULT 50000,
ADD COLUMN     "subscriptionAutoExpireListings" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subscriptionAutoExpireMonths" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "subscriptionEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscriptionMomoKind" "PayoutTargetKind" NOT NULL DEFAULT 'PHONE',
ADD COLUMN     "subscriptionMomoNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "subscriptionMonthlyPrice" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "subscriptionRequireOnPublish" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "subscriptionExpiresAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionPlan" "SubscriptionPlan",
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'NONE';
