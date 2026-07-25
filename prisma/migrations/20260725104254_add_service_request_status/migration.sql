-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "status" "ServiceRequestStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill: existing paid requests → PAID
UPDATE "ServiceRequest" SET "status" = 'PAID' WHERE "isPaid" = true;

-- Backfill: requests linked to cancelled orders → CANCELLED
UPDATE "ServiceRequest" sr
SET "status" = 'CANCELLED'
FROM "Order" o
WHERE o."serviceRequestId" = sr."id"
  AND o."status" = 'CANCELLED';
