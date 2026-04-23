/*
  Warnings:

  - Changed the type of `serviceType` on the `services` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('SOCIAL_POST', 'SERVICE');

-- AlterTable
ALTER TABLE "services" DROP COLUMN "serviceType",
ADD COLUMN     "serviceType" "ServiceType" NOT NULL;
