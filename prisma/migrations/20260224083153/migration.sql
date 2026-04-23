/*
  Warnings:

  - You are about to drop the column `conversationID` on the `ServiceRequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ServiceRequest" DROP COLUMN "conversationID",
ADD COLUMN     "messageID" TEXT NOT NULL DEFAULT '1';
