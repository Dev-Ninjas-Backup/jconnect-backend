-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'UploadProof';
ALTER TYPE "NotificationType" ADD VALUE 'PaymentReminder';
ALTER TYPE "NotificationType" ADD VALUE 'follow';

-- AlterTable
ALTER TABLE "notification-toggle" ADD COLUMN     "PaymentReminder" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "UploadProof" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "follow" BOOLEAN NOT NULL DEFAULT true;
