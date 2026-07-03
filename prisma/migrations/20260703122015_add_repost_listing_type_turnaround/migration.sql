-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RepostPlatform" ADD VALUE 'INSTAGRAM_REEL';
ALTER TYPE "RepostPlatform" ADD VALUE 'TIKTOK_DUET';

-- AlterTable
ALTER TABLE "repost_listings" ADD COLUMN     "defaultTurnaround" "RepostTimeframe" NOT NULL DEFAULT 'TWENTY_FOUR_HOURS';
