-- AlterTable
ALTER TABLE "Order" ADD COLUMN "isCancelRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cancelRequestedAt" TIMESTAMP(3);
