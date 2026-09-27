-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "PayoutTargetKind" AS ENUM ('PHONE', 'MOMO_CODE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "commissionAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "commissionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "commissionType" "CommissionType" NOT NULL DEFAULT 'PERCENT',
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionFixed" INTEGER NOT NULL DEFAULT 0,
    "commissionMin" INTEGER NOT NULL DEFAULT 0,
    "commissionMax" INTEGER NOT NULL DEFAULT 0,
    "payoutKind" "PayoutTargetKind" NOT NULL DEFAULT 'PHONE',
    "payoutValue" TEXT NOT NULL DEFAULT '',
    "chargingStartsAt" TIMESTAMP(3),
    "freePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
