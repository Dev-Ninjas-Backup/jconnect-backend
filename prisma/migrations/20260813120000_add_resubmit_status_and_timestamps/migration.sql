-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'RESUBMIT';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "inProgressAt" TIMESTAMP(3),
ADD COLUMN "resubmitAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3);

ALTER TABLE "Order" ALTER COLUMN "proofSubmittedAt" DROP NOT NULL;
