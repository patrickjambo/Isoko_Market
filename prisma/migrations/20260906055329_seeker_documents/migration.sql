-- CreateEnum
CREATE TYPE "SeekerDocumentType" AS ENUM ('CV', 'COVER_LETTER', 'CERTIFICATE', 'ID_DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "SeekerDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "SeekerDocumentType" NOT NULL DEFAULT 'OTHER',
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeekerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeekerDocument_userId_idx" ON "SeekerDocument"("userId");

-- AddForeignKey
ALTER TABLE "SeekerDocument" ADD CONSTRAINT "SeekerDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
