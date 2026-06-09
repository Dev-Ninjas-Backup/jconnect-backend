import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { RepostPlatform } from "@prisma/client";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import {
    CreateRepostListingDto,
    ToggleListingDto,
    UpdateRepostListingDto,
} from "./dto/repost-listing.dto";

@Injectable()
export class RepostListingService {
    constructor(
        private prisma: PrismaService,
        private notifications: FirebaseNotificationService,
    ) {}

    async create(sellerId: string, dto: CreateRepostListingDto) {
        const listing = await this.prisma.repostListing.create({
            data: {
                sellerId,
                platform: dto.platform,
                price: dto.price,
                followerCount: dto.followerCount,
                description: dto.description,
                isSpotlight: dto.price === 1,
            },
        });

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

    findBySeller(sellerId: string) {
        return this.prisma.repostListing.findMany({
            where: { sellerId },
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

    async update(id: string, sellerId: string, dto: UpdateRepostListingDto) {
        const listing = await this.prisma.repostListing.findUnique({ where: { id } });
        if (!listing) throw new NotFoundException("Repost listing not found");
        if (listing.sellerId !== sellerId) throw new ForbiddenException("Not your listing");

        const isSpotlight = dto.price !== undefined ? dto.price === 1 : listing.isSpotlight;

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
