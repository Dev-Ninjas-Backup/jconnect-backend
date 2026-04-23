-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "messageID" SET DEFAULT '';
