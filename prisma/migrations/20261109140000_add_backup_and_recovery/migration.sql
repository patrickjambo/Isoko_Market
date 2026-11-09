-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('FULL', 'INCREMENTAL', 'SAFETY_SNAPSHOT');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('IN_PROGRESS', 'SUCCESS', 'FAILED', 'CORRUPTED');

-- CreateEnum
CREATE TYPE "RestorationType" AS ENUM ('FULL', 'SELECTIVE');

-- CreateEnum
CREATE TYPE "RestorationStatus" AS ENUM ('IN_PROGRESS', 'SUCCESS', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('COMPLETED', 'FAILED', 'ISSUES_FOUND');

-- CreateTable
CREATE TABLE "BackupRecord" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "type" "BackupType" NOT NULL DEFAULT 'FULL',
    "status" "BackupStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "scope" TEXT[],
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "checksumSha256" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT true,
    "encryptionAlg" TEXT NOT NULL DEFAULT 'aes-256-gcm',
    "storageLocation" TEXT NOT NULL,
    "createdById" TEXT,
    "metadata" JSONB,
    "notes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestorationRecord" (
    "id" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "type" "RestorationType" NOT NULL DEFAULT 'FULL',
    "status" "RestorationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "targetScope" TEXT[],
    "preRestoreSnapshotId" TEXT,
    "recordsRestored" INTEGER NOT NULL DEFAULT 0,
    "filesRestored" INTEGER NOT NULL DEFAULT 0,
    "performedById" TEXT NOT NULL,
    "report" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RestorationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataIntegrityScan" (
    "id" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'COMPLETED',
    "issuesCount" INTEGER NOT NULL DEFAULT 0,
    "issues" JSONB,
    "recordsScanned" INTEGER NOT NULL DEFAULT 0,
    "filesScanned" INTEGER NOT NULL DEFAULT 0,
    "scannedById" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataIntegrityScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackupRecord_status_idx" ON "BackupRecord"("status");

-- CreateIndex
CREATE INDEX "BackupRecord_type_idx" ON "BackupRecord"("type");

-- CreateIndex
CREATE INDEX "BackupRecord_createdAt_idx" ON "BackupRecord"("createdAt");

-- CreateIndex
CREATE INDEX "RestorationRecord_status_idx" ON "RestorationRecord"("status");

-- CreateIndex
CREATE INDEX "RestorationRecord_backupId_idx" ON "RestorationRecord"("backupId");

-- CreateIndex
CREATE INDEX "RestorationRecord_createdAt_idx" ON "RestorationRecord"("createdAt");

-- CreateIndex
CREATE INDEX "DataIntegrityScan_status_idx" ON "DataIntegrityScan"("status");

-- CreateIndex
CREATE INDEX "DataIntegrityScan_createdAt_idx" ON "DataIntegrityScan"("createdAt");

-- AddForeignKey
ALTER TABLE "BackupRecord" ADD CONSTRAINT "BackupRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestorationRecord" ADD CONSTRAINT "RestorationRecord_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "BackupRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestorationRecord" ADD CONSTRAINT "RestorationRecord_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataIntegrityScan" ADD CONSTRAINT "DataIntegrityScan_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
