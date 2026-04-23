-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'Inquiry';

-- AlterTable
ALTER TABLE "notification-toggle" ADD COLUMN     "Inquiry" BOOLEAN NOT NULL DEFAULT true;
