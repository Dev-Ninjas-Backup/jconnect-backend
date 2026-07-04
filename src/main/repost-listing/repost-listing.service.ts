import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { RepostPlatform } from "@prisma/client";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import Stripe from "stripe";
import {
    CreateRepostListingDto,
    ToggleListingDto,
    UpdateRepostListingDto,
} from "./dto/repost-listing.dto";

const REPOST_LISTING_PLATFORMS = [
    {
        label: "Instagram",
        value: "INSTAGRAM",
        repostTypes: [
            { label: "Story Repost", value: RepostPlatform.INSTAGRAM_STORY },
            { label: "Feed Repost", value: RepostPlatform.INSTAGRAM_FEED },
            { label: "Reel Repost", value: RepostPlatform.INSTAGRAM_REEL },
        ],
    },
    {
        label: "Tiktok",
        value: "TIKTOK",
        repostTypes: [
            { label: "Repost", value: RepostPlatform.TIKTOK },
            { label: "Duet / Stitch Repost", value: RepostPlatform.TIKTOK_DUET },
        ],
    },
    {
        label: "X",
        value: "TWITTER",
        repostTypes: [
            { label: "Repost", value: RepostPlatform.TWITTER },
            { label: "Quote Repost", value: RepostPlatform.TWITTER_QUOTE },
        ],
    },
    {
        label: "YouTube",
        value: "YOUTUBE",
        repostTypes: [
            { label: "Community Post Repost", value: RepostPlatform.YOUTUBE_COMMUNITY_POST },
            { label: "Video Repost (Shorts)", value: RepostPlatform.YOUTUBE_SHORTS },
        ],
    },
    {
        label: "Facebook",
        value: "FACEBOOK",
        repostTypes: [
            { label: "Post Repost", value: RepostPlatform.FACEBOOK_POST },
            { label: "Story Repost", value: RepostPlatform.FACEBOOK_STORY },
        ],
    },
] as const;

// Discontinued repost types — no longer offered for new/updated listings, but kept
// in the RepostPlatform enum since Postgres enum values can't be dropped without a
// table rewrite, and existing rows (if any) should keep displaying correctly.
const DEPRECATED_PLATFORMS: RepostPlatform[] = [RepostPlatform.INSTAGRAM_IGTV];

@Injectable()
export class RepostListingService {
    constructor(
        private prisma: PrismaService,
        private notifications: FirebaseNotificationService,
        @Inject("STRIPE_CLIENT") private readonly stripe: Stripe,
    ) {}

    async create(sellerId: string, dto: CreateRepostListingDto) {
        if (DEPRECATED_PLATFORMS.includes(dto.platform))
            throw new BadRequestException(`${dto.platform} is no longer available`);

        const seller = await this.prisma.user.findUnique({
            where: { id: sellerId },
            select: { username: true, full_name: true },
        });

        const listing = await this.prisma.repostListing.create({
            data: {
                sellerId,
                platform: dto.platform,
                price: dto.price,
                followerCount: dto.followerCount,
                description: dto.description,
                defaultTurnaround: dto.defaultTurnaround,
                isSpotlight: dto.isSpotlight ?? dto.price === 1,
            },
        });

        // Notify seller
        if (listing.isSpotlight) {
            await this.notifications.sendToUser(sellerId, {
                title: "Listed in $1 Repost Spotlight!",
                body: "Your listing has been automatically featured in the $1 Repost Spotlight.",
                type: "LISTING_FEATURED" as any,
                data: { listingId: listing.id },
            });
        } else {
            await this.notifications.sendToUser(sellerId, {
                title: "Listing Approved",
                body: "Your repost listing is now live on the marketplace.",
                type: "LISTING_APPROVED" as any,
                data: { listingId: listing.id },
            });
        }

        // Notify all followers of this seller
        const followers = await this.prisma.follow.findMany({
            where: { followingId: sellerId },
            select: { followerId: true },
        });

        if (followers.length > 0) {
            const handle = seller?.username ?? seller?.full_name ?? "Someone you follow";
            const platformLabel = dto.platform.replace(/_/g, " ");
            await Promise.all(
                followers.map((f) =>
                    this.notifications.sendToUser(f.followerId, {
                        title: "New Repost Available",
                        body: `@${handle} just listed a new ${platformLabel} repost.`,
                        type: "FOLLOWED_SELLER_NEW_LISTING" as any,
                        data: { listingId: listing.id, sellerId },
                    }),
                ),
            );
        }

        return listing;
    }

    findAll(platform?: RepostPlatform, spotlightOnly?: boolean) {
        return this.prisma.repostListing.findMany({
            where: {
                isActive: true,
                isPaused: false,
                ...(platform && { platform }),
                ...(spotlightOnly && { isSpotlight: true }),
            },
            include: {
                seller: {
                    select: {
                        id: true,
                        full_name: true,
                        username: true,
                        profilePhoto: true,
                        isProfileVerified: true,
                    },
                },
            },
            orderBy: [{ isSpotlight: "desc" }, { createdAt: "desc" }],
        });
    }

    async findByFollowing(buyerId: string) {
        const following = await this.prisma.follow.findMany({
            where: { followerId: buyerId },
            select: { followingId: true },
        });

        if (following.length === 0) return [];

        const sellerIds = following.map((f) => f.followingId);

        return this.prisma.repostListing.findMany({
            where: {
                sellerId: { in: sellerIds },
                isActive: true,
                isPaused: false,
            },
            include: {
                seller: {
                    select: {
                        id: true,
                        full_name: true,
                        username: true,
                        profilePhoto: true,
                        isProfileVerified: true,
                    },
                },
            },
            orderBy: [{ isSpotlight: "desc" }, { createdAt: "desc" }],
        });
    }

    findByArtist(artistId: string) {
        return this.prisma.repostListing.findMany({
            where: {
                sellerId: artistId,
                isActive: true,
                isPaused: false,
            },
            include: {
                seller: {
                    select: {
                        id: true,
                        full_name: true,
                        username: true,
                        profilePhoto: true,
                        isProfileVerified: true,
                    },
                },
            },
            orderBy: [{ isSpotlight: "desc" }, { createdAt: "desc" }],
        });
    }

    findBySeller(sellerId: string, status?: "active" | "inactive") {
        return this.prisma.repostListing.findMany({
            where: {
                sellerId,
                ...(status === "active" && { isPaused: false }),
                ...(status === "inactive" && { isPaused: true }),
            },
            orderBy: { createdAt: "desc" },
        });
    }

    async findOne(id: string) {
        const listing = await this.prisma.repostListing.findUnique({
            where: { id },
            include: {
                seller: {
                    select: {
                        id: true,
                        full_name: true,
                        username: true,
                        profilePhoto: true,
                        isProfileVerified: true,
                    },
                },
            },
        });
        if (!listing) throw new NotFoundException("Repost listing not found");
        return listing;
    }

    // Screen 3 (Content & Payment) — "Pay Now" pre-authorizes the charge on the
    // buyer's saved card. The hold is captured later when escrow releases
    // (see RepostOrderService.releaseEscrow) and voided on reject/refund.
    async pay(listingId: string, buyerId: string) {
        const listing = await this.prisma.repostListing.findUnique({ where: { id: listingId } });
        if (!listing) throw new NotFoundException("Repost listing not found");
        if (!listing.isActive || listing.isPaused)
            throw new BadRequestException("This listing is not available");
        if (listing.sellerId === buyerId)
            throw new BadRequestException("You cannot buy your own listing");

        const buyer = await this.prisma.user.findUnique({
            where: { id: buyerId },
            include: { paymentMethod: true },
        });
        if (!buyer) throw new NotFoundException("User not found");
        if (!buyer.customerIdStripe)
            throw new BadRequestException("User does not have a Stripe Customer ID");
        if (!buyer.paymentMethod?.[0]?.paymentMethod)
            throw new BadRequestException("No saved payment method on file");

        const amount = Math.round(listing.price * 100);

        const paymentIntent = await this.stripe.paymentIntents.create({
            amount,
            currency: "usd",
            customer: buyer.customerIdStripe,
            payment_method: buyer.paymentMethod[0].paymentMethod,
            off_session: true,
            confirm: true,
            capture_method: "manual",
            metadata: {
                buyerId,
                listingId,
            },
        });

        return {
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            listingId,
        };
    }

    async update(id: string, sellerId: string, dto: UpdateRepostListingDto) {
        if (dto.platform && DEPRECATED_PLATFORMS.includes(dto.platform))
            throw new BadRequestException(`${dto.platform} is no longer available`);

        const listing = await this.prisma.repostListing.findUnique({ where: { id } });
        if (!listing) throw new NotFoundException("Repost listing not found");
        if (listing.sellerId !== sellerId) throw new ForbiddenException("Not your listing");

        const isSpotlight =
            dto.isSpotlight ?? (dto.price !== undefined ? dto.price === 1 : listing.isSpotlight);

        return this.prisma.repostListing.update({
            where: { id },
            data: { ...dto, isSpotlight },
        });
    }

    async togglePause(id: string, sellerId: string, dto: ToggleListingDto) {
        const listing = await this.prisma.repostListing.findUnique({ where: { id } });
        if (!listing) throw new NotFoundException("Repost listing not found");
        if (listing.sellerId !== sellerId) throw new ForbiddenException("Not your listing");

        const updated = await this.prisma.repostListing.update({
            where: { id },
            data: { isPaused: dto.isPaused },
        });

        const notifType = dto.isPaused ? "LISTING_PAUSED" : "LISTING_REACTIVATED";
        const notifBody = dto.isPaused
            ? "Your repost listing has been paused."
            : "Your repost listing is active again.";

        await this.notifications.sendToUser(sellerId, {
            title: dto.isPaused ? "Listing Paused" : "Listing Reactivated",
            body: notifBody,
            type: notifType as any,
            data: { listingId: id },
        });

        return updated;
    }

    async remove(id: string, sellerId: string) {
        const listing = await this.prisma.repostListing.findUnique({ where: { id } });
        if (!listing) throw new NotFoundException("Repost listing not found");
        if (listing.sellerId !== sellerId) throw new ForbiddenException("Not your listing");

        await this.notifications.sendToUser(sellerId, {
            title: "Listing Removed",
            body: "Your repost listing has been removed.",
            type: "LISTING_REMOVED" as any,
            data: { listingId: id },
        });

        return this.prisma.repostListing.delete({ where: { id } });
    }

    getSpotlightListings() {
        return this.prisma.repostListing.findMany({
            where: { isSpotlight: true, isActive: true, isPaused: false },
            include: {
                seller: {
                    select: {
                        id: true,
                        full_name: true,
                        username: true,
                        profilePhoto: true,
                        isProfileVerified: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    getPlatforms() {
        return REPOST_LISTING_PLATFORMS;
    }

    getSellerDashboard(sellerId: string) {
        return this.prisma.repostListing.findMany({
            where: { sellerId },
            include: {
                _count: { select: { repostOrders: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    }
}
