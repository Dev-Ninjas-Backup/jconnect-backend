-- CreateEnum
CREATE TYPE "SocialLogo" AS ENUM ('SELECT', 'FACEBOOK', 'INSTAGRAM', 'TWITTER', 'LINKEDIN', 'YOUTUBE', 'SNAPCHAT', 'TWITCH');

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "socialLogo" "SocialLogo" DEFAULT 'SELECT';
