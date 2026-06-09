-- CreateEnum
CREATE TYPE "RepostPlatform" AS ENUM ('INSTAGRAM_STORY', 'INSTAGRAM_FEED', 'TIKTOK', 'YOUTUBE', 'FACEBOOK', 'TWITTER');

-- CreateEnum
CREATE TYPE "RepostTimeframe" AS ENUM ('THIRTY_MIN', 'ONE_HOUR', 'TWO_HOURS', 'SIX_HOURS', 'TWELVE_HOURS', 'TWENTY_FOUR_HOURS');

-- CreateEnum
CREATE TYPE "RepostOrderStatus" AS ENUM ('NEW_REQUEST', 'ACCEPTED', 'IN_PROGRESS', 'PROOF_SUBMITTED', 'REVIEW_WINDOW', 'REDO_REQUESTED', 'COMPLETED', 'REJECTED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ProofType" AS ENUM ('SCREENSHOT', 'SCREEN_RECORDING', 'URL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'REPOST_ORDER_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_SELLER_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_SELLER_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_PROOF_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_REVIEW_WINDOW_STARTED';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_REDO_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_FUNDS_RELEASED';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_DISPUTE_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_NEW_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_EXPIRING_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_REQUEST_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_PROOF_SENT';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_REDO_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_SELLER_FUNDS_RELEASED';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_DISPUTE_OPENED';
ALTER TYPE "NotificationType" ADD VALUE 'ESCROW_FUNDS_HELD';
ALTER TYPE "NotificationType" ADD VALUE 'ESCROW_REFUND_ISSUED';
ALTER TYPE "NotificationType" ADD VALUE 'ESCROW_FUNDS_RELEASED';
ALTER TYPE "NotificationType" ADD VALUE 'ESCROW_FUNDS_PENDING';
ALTER TYPE "NotificationType" ADD VALUE 'ESCROW_REFUND_PROCESSED';
ALTER TYPE "NotificationType" ADD VALUE 'LISTING_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'LISTING_PAUSED';
ALTER TYPE "NotificationType" ADD VALUE 'LISTING_REACTIVATED';
ALTER TYPE "NotificationType" ADD VALUE 'LISTING_REMOVED';
ALTER TYPE "NotificationType" ADD VALUE 'LISTING_FEATURED';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_REVIEW_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'RATING_INCREASED';
ALTER TYPE "NotificationType" ADD VALUE 'RATING_DECREASED';
ALTER TYPE "NotificationType" ADD VALUE 'REPOST_MILESTONE';
ALTER TYPE "NotificationType" ADD VALUE 'EARNINGS_MILESTONE';
ALTER TYPE "NotificationType" ADD VALUE 'WELCOME';
ALTER TYPE "NotificationType" ADD VALUE 'PASSWORD_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'LOGIN_DETECTED';
ALTER TYPE "NotificationType" ADD VALUE 'SECURITY_ALERT';
ALTER TYPE "NotificationType" ADD VALUE 'PROFILE_VERIFICATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'PROFILE_VERIFICATION_REJECTED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isProfileVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "repost_listings" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "platform" "RepostPlatform" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "followerCount" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "isSpotlight" BOOLEAN NOT NULL DEFAULT false,
    "totalPurchases" INTEGER NOT NULL DEFAULT 0,
    "totalAccepts" INTEGER NOT NULL DEFAULT 0,
    "totalProofs" INTEGER NOT NULL DEFAULT 0,
    "totalRedos" INTEGER NOT NULL DEFAULT 0,
    "totalAutoReleases" INTEGER NOT NULL DEFAULT 0,
    "totalCompleted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repost_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repost_orders" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "platform" "RepostPlatform" NOT NULL,
    "timeframe" "RepostTimeframe" NOT NULL,
    "amount" INTEGER NOT NULL,
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "sellerAmount" INTEGER NOT NULL DEFAULT 0,
    "status" "RepostOrderStatus" NOT NULL DEFAULT 'NEW_REQUEST',
    "contentUrl" TEXT,
    "contentFiles" TEXT[],
    "countdownEndsAt" TIMESTAMP(3) NOT NULL,
    "proofType" "ProofType",
    "proofUrl" TEXT,
    "proofFiles" TEXT[],
    "proofSubmittedAt" TIMESTAMP(3),
    "reviewWindowEndsAt" TIMESTAMP(3),
    "redoWindowEndsAt" TIMESTAMP(3),
    "redoCount" INTEGER NOT NULL DEFAULT 0,
    "paymentIntentId" TEXT,
    "isReleased" BOOLEAN NOT NULL DEFAULT false,
    "releasedAt" TIMESTAMP(3),
    "alert60Sent" BOOLEAN NOT NULL DEFAULT false,
    "alert30Sent" BOOLEAN NOT NULL DEFAULT false,
    "alert15Sent" BOOLEAN NOT NULL DEFAULT false,
    "alert5Sent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repost_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repost_orders_orderCode_key" ON "repost_orders"("orderCode");

-- CreateIndex
CREATE INDEX "repost_orders_status_idx" ON "repost_orders"("status");

-- CreateIndex
CREATE INDEX "repost_orders_countdownEndsAt_idx" ON "repost_orders"("countdownEndsAt");

-- CreateIndex
CREATE INDEX "repost_orders_reviewWindowEndsAt_idx" ON "repost_orders"("reviewWindowEndsAt");

-- AddForeignKey
ALTER TABLE "repost_listings" ADD CONSTRAINT "repost_listings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repost_orders" ADD CONSTRAINT "repost_orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repost_orders" ADD CONSTRAINT "repost_orders_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repost_orders" ADD CONSTRAINT "repost_orders_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "repost_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
