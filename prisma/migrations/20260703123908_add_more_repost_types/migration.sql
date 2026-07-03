-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RepostPlatform" ADD VALUE 'INSTAGRAM_IGTV';
ALTER TYPE "RepostPlatform" ADD VALUE 'TWITTER_QUOTE';
ALTER TYPE "RepostPlatform" ADD VALUE 'YOUTUBE_COMMUNITY_POST';
ALTER TYPE "RepostPlatform" ADD VALUE 'YOUTUBE_SHORTS';
ALTER TYPE "RepostPlatform" ADD VALUE 'FACEBOOK_POST';
ALTER TYPE "RepostPlatform" ADD VALUE 'FACEBOOK_STORY';
