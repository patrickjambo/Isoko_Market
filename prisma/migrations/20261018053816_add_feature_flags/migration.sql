-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "cvBuilderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hiringEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jobsEnabled" BOOLEAN NOT NULL DEFAULT false;
