-- AlterTable Listing price to DOUBLE PRECISION to support high-value Rwandan assets (land, cars, houses > 21M RWF)
ALTER TABLE "Listing" ALTER COLUMN "price" TYPE DOUBLE PRECISION;
